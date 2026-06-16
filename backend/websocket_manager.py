import asyncio
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

from game import (
    BattleshipAI,
    attack,
    generate_random_ships,
    get_ship_cells,
    get_sunk_ship,
    is_game_over,
    place_ships,
)
from lobby import Room
from models import Board, RoomStatus

AI_MOVE_DELAY_SECONDS = 0.8


class GameSession:
    def __init__(self, room_code: str, vs_ai: bool) -> None:
        self.room_code = room_code
        self.vs_ai = vs_ai
        self.connections: Dict[str, WebSocket] = {}
        self.usernames: Dict[str, str] = {}
        self.boards: Dict[str, Board] = {"player1": Board(), "player2": Board()}
        self.turn: str = "player1"
        self.ai: Optional[BattleshipAI] = BattleshipAI() if vs_ai else None
        self.rematch_requests: set = set()
        self.lock = asyncio.Lock()
        self.finished = False

        if vs_ai:
            self.usernames["player2"] = "AI"
            place_ships(self.boards["player2"], generate_random_ships())

    def opponent_key(self, key: str) -> str:
        return "player2" if key == "player1" else "player1"


sessions: Dict[str, GameSession] = {}


def get_or_create_session(room_code: str, room: Room) -> GameSession:
    session = sessions.get(room_code)
    if session is None:
        session = GameSession(room_code, room.vs_ai)
        sessions[room_code] = session
    return session


def remove_session(room_code: str) -> None:
    sessions.pop(room_code, None)


async def send_to_player(session: GameSession, player_key: str, message: dict) -> None:
    ws = session.connections.get(player_key)
    if ws is None:
        return
    try:
        await ws.send_json(message)
    except Exception:
        pass


async def broadcast(session: GameSession, message: dict) -> None:
    await send_to_player(session, "player1", message)
    await send_to_player(session, "player2", message)


async def finish_game(session: GameSession, room: Room, winner_key: str) -> None:
    room.status = RoomStatus.FINISHED
    session.finished = True
    loser_key = session.opponent_key(winner_key)
    enemy_board = session.boards[loser_key].grid
    await broadcast(session, {"type": "game_over", "winner": winner_key, "enemy_board": enemy_board})


async def ai_take_turn(session: GameSession, room: Room) -> None:
    await asyncio.sleep(AI_MOVE_DELAY_SECONDS)
    async with session.lock:
        if room.status != RoomStatus.PLAYING or session.turn != "player2" or session.ai is None:
            return

        human_board = session.boards["player1"]
        row, col = session.ai.choose_target()
        result = attack(human_board, row, col)
        session.ai.register_result(row, col, result)
        ship_id = get_sunk_ship(human_board, row, col) if result == "sunk" else None
        ship_cells = get_ship_cells(human_board, ship_id) if ship_id else None
        session.turn = "player1"

        await send_to_player(
            session,
            "player1",
            {
                "type": "attack_result",
                "row": row,
                "col": col,
                "result": result,
                "ship_id": ship_id,
                "ship_cells": ship_cells,
                "current_turn": session.turn,
            },
        )

        if is_game_over(human_board):
            await finish_game(session, room, winner_key="player2")


async def handle_place_ships(session: GameSession, room: Room, player_key: str, data: dict) -> None:
    async with session.lock:
        if room.status != RoomStatus.PLACEMENT:
            raise ValueError("No estás en la fase de colocación")

        board = session.boards[player_key]
        ships = data.get("ships")
        if not isinstance(ships, list):
            raise ValueError("Formato de barcos inválido")

        place_ships(board, ships)
        await send_to_player(session, player_key, {"type": "placement_ok"})

        opponent_key = session.opponent_key(player_key)
        opponent_board = session.boards[opponent_key]

        if opponent_board.ready:
            room.status = RoomStatus.PLAYING
            session.turn = "player1"
            await send_to_player(session, "player1", {"type": "game_start", "your_turn": True})
            await send_to_player(session, "player2", {"type": "game_start", "your_turn": False})
        else:
            await send_to_player(session, player_key, {"type": "waiting_placement"})


async def handle_attack(session: GameSession, room: Room, player_key: str, data: dict) -> None:
    async with session.lock:
        if room.status != RoomStatus.PLAYING:
            raise ValueError("La partida no está en curso")
        if session.turn != player_key:
            raise ValueError("No es tu turno")

        row, col = data.get("row"), data.get("col")
        if not isinstance(row, int) or not isinstance(col, int):
            raise ValueError("Coordenadas inválidas")

        opponent_key = session.opponent_key(player_key)
        opponent_board = session.boards[opponent_key]

        result = attack(opponent_board, row, col)
        ship_id = get_sunk_ship(opponent_board, row, col) if result == "sunk" else None
        ship_cells = get_ship_cells(opponent_board, ship_id) if ship_id else None
        session.turn = opponent_key

        await broadcast(
            session,
            {
                "type": "attack_result",
                "row": row,
                "col": col,
                "result": result,
                "ship_id": ship_id,
                "ship_cells": ship_cells,
                "current_turn": session.turn,
            },
        )

        if is_game_over(opponent_board):
            await finish_game(session, room, winner_key=player_key)
            return

    if session.vs_ai and session.turn == "player2" and not session.finished:
        asyncio.create_task(ai_take_turn(session, room))


async def handle_surrender(session: GameSession, room: Room, player_key: str) -> None:
    async with session.lock:
        if room.status not in (RoomStatus.PLACEMENT, RoomStatus.PLAYING):
            raise ValueError("No hay partida en curso")
        winner_key = session.opponent_key(player_key)
        await finish_game(session, room, winner_key=winner_key)


async def handle_rematch(session: GameSession, room: Room, player_key: str) -> None:
    async with session.lock:
        if room.status != RoomStatus.FINISHED:
            raise ValueError("La partida no ha terminado")

        session.rematch_requests.add(player_key)
        required = {"player1"} if session.vs_ai else {"player1", "player2"}

        if required.issubset(session.rematch_requests):
            session.boards = {"player1": Board(), "player2": Board()}
            session.turn = "player1"
            session.rematch_requests.clear()
            session.finished = False
            room.status = RoomStatus.PLACEMENT

            if session.vs_ai:
                session.ai = BattleshipAI()
                place_ships(session.boards["player2"], generate_random_ships())

            await broadcast(session, {"type": "waiting_placement"})
        else:
            await send_to_player(session, player_key, {"type": "waiting_placement"})


async def handle_message(session: GameSession, room: Room, player_key: str, data: dict) -> None:
    msg_type = data.get("type")
    try:
        if msg_type == "place_ships":
            await handle_place_ships(session, room, player_key, data)
        elif msg_type == "attack":
            await handle_attack(session, room, player_key, data)
        elif msg_type == "rematch":
            await handle_rematch(session, room, player_key)
        elif msg_type == "surrender":
            await handle_surrender(session, room, player_key)
        else:
            await send_to_player(session, player_key, {"type": "error", "message": "Tipo de mensaje desconocido"})
    except ValueError as exc:
        await send_to_player(session, player_key, {"type": "error", "message": str(exc)})


async def handle_disconnect(session: GameSession, room: Room, player_key: str) -> None:
    if session.finished:
        return
    username = session.usernames.get(player_key, "?")
    opponent_key = session.opponent_key(player_key)
    room.status = RoomStatus.FINISHED
    session.finished = True
    await send_to_player(session, opponent_key, {"type": "player_disconnected", "username": username})


async def handle_connection(websocket: WebSocket, room: Room, username: str) -> None:
    if username == room.player1:
        player_key = "player1"
    elif room.player2 is not None and username == room.player2:
        player_key = "player2"
    else:
        await websocket.close(code=4403)
        return

    await websocket.accept()

    session = get_or_create_session(room.code, room)
    session.connections[player_key] = websocket
    session.usernames[player_key] = username

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                raise
            except Exception:
                await send_to_player(session, player_key, {"type": "error", "message": "JSON inválido"})
                continue

            if not isinstance(data, dict):
                await send_to_player(session, player_key, {"type": "error", "message": "Mensaje inválido"})
                continue

            await handle_message(session, room, player_key, data)
    except WebSocketDisconnect:
        await handle_disconnect(session, room, player_key)
    finally:
        session.connections.pop(player_key, None)
