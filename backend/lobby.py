import asyncio
import random
import string
from dataclasses import dataclass
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException

from config import settings
from models import NicknameRequest, RoomCreateResponse, RoomJoinResponse, RoomStateResponse, RoomStatus


@dataclass
class Room:
    code: str
    player1: str
    player2: Optional[str] = None
    status: RoomStatus = RoomStatus.WAITING
    vs_ai: bool = False
    close_task: Optional[asyncio.Task] = None


class RoomManager:
    def __init__(self) -> None:
        self.rooms: Dict[str, Room] = {}

    def _generate_code(self) -> str:
        while True:
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if code not in self.rooms:
                return code

    def create_room(self, username: str) -> Room:
        code = self._generate_code()
        room = Room(code=code, player1=username)
        self.rooms[code] = room
        room.close_task = asyncio.create_task(self._auto_close(code))
        return room

    async def _auto_close(self, code: str) -> None:
        await asyncio.sleep(settings.ROOM_WAITING_TIMEOUT_SECONDS)
        room = self.rooms.get(code)
        if room and room.status == RoomStatus.WAITING and room.player2 is None and not room.vs_ai:
            del self.rooms[code]

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get(code)

    def join_room(self, code: str, username: str) -> Room:
        room = self.rooms.get(code)
        if room is None:
            raise ValueError("La sala no existe")
        if room.status != RoomStatus.WAITING or room.player2 is not None or room.vs_ai:
            raise ValueError("La sala está llena")
        if room.player1 == username:
            raise ValueError("No puedes unirte a tu propia sala")
        room.player2 = username
        room.status = RoomStatus.PLACEMENT
        if room.close_task:
            room.close_task.cancel()
        return room

    def set_vs_ai(self, code: str, username: str) -> Room:
        room = self.rooms.get(code)
        if room is None:
            raise ValueError("La sala no existe")
        if room.player1 != username:
            raise ValueError("Solo el creador de la sala puede activar la IA")
        if room.player2 is not None:
            raise ValueError("La sala ya tiene un segundo jugador")
        room.vs_ai = True
        room.player2 = "AI"
        room.status = RoomStatus.PLACEMENT
        if room.close_task:
            room.close_task.cancel()
        return room

    def delete_room(self, code: str) -> None:
        self.rooms.pop(code, None)


room_manager = RoomManager()

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("/create", response_model=RoomCreateResponse)
async def create_room(data: NicknameRequest) -> RoomCreateResponse:
    room = room_manager.create_room(data.username)
    return RoomCreateResponse(code=room.code, status=room.status, player1=room.player1)


@router.post("/join/{code}", response_model=RoomJoinResponse)
async def join_room(code: str, data: NicknameRequest) -> RoomJoinResponse:
    try:
        room = room_manager.join_room(code.upper(), data.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return RoomJoinResponse(code=room.code, status=room.status, player1=room.player1, player2=room.player2)


@router.post("/{code}/vs-ai", response_model=RoomStateResponse)
async def play_vs_ai(code: str, data: NicknameRequest) -> RoomStateResponse:
    try:
        room = room_manager.set_vs_ai(code.upper(), data.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return RoomStateResponse(
        code=room.code, status=room.status, player1=room.player1, player2=room.player2, vs_ai=room.vs_ai
    )


@router.get("/{code}", response_model=RoomStateResponse)
async def get_room(code: str) -> RoomStateResponse:
    room = room_manager.get_room(code.upper())
    if room is None:
        raise HTTPException(status_code=404, detail="La sala no existe")
    return RoomStateResponse(
        code=room.code, status=room.status, player1=room.player1, player2=room.player2, vs_ai=room.vs_ai
    )
