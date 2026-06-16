import random
from typing import Dict, List, Optional, Tuple

from models import BOARD_SIZE, FLEET, FLEET_SIZES, HIT, SHIP, SUNK, WATER, Board, ShipPlacement


def _cells_form_valid_line(cells: List[Tuple[int, int]], expected_size: int) -> bool:
    if len(cells) != expected_size:
        return False
    if len(set(cells)) != len(cells):
        return False
    rows = sorted(c[0] for c in cells)
    cols = sorted(c[1] for c in cells)
    if all(r == rows[0] for r in rows):
        # horizontal: same row, consecutive columns
        return cols == list(range(cols[0], cols[0] + expected_size))
    if all(c == cols[0] for c in cols):
        # vertical: same column, consecutive rows
        return rows == list(range(rows[0], rows[0] + expected_size))
    return False


def _touches_occupied(cells: List[Tuple[int, int]], occupied: set) -> bool:
    for row, col in cells:
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if (row + dr, col + dc) in occupied:
                    return True
    return False


def place_ships(board: Board, ships_input: List[Dict]) -> None:
    if board.ready:
        raise ValueError("Los barcos ya han sido colocados")

    if len(ships_input) != len(FLEET):
        raise ValueError("Debes colocar exactamente toda la flota")

    seen_ids = set()
    occupied: set = set()
    placements: List[ShipPlacement] = []

    for ship in ships_input:
        ship_id = ship.get("id")
        raw_cells = ship.get("cells")

        if ship_id not in FLEET_SIZES:
            raise ValueError(f"Barco desconocido: {ship_id}")
        if ship_id in seen_ids:
            raise ValueError(f"Barco duplicado: {ship_id}")
        seen_ids.add(ship_id)

        if not isinstance(raw_cells, list):
            raise ValueError(f"Celdas inválidas para el barco {ship_id}")

        cells: List[Tuple[int, int]] = []
        for cell in raw_cells:
            if not isinstance(cell, (list, tuple)) or len(cell) != 2:
                raise ValueError(f"Celda inválida para el barco {ship_id}")
            row, col = cell[0], cell[1]
            if not (0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE):
                raise ValueError(f"El barco {ship_id} se sale del tablero")
            cells.append((row, col))

        expected_size = FLEET_SIZES[ship_id]
        if not _cells_form_valid_line(cells, expected_size):
            raise ValueError(f"El barco {ship_id} debe ser una línea recta de {expected_size} celdas")

        if occupied.intersection(cells):
            raise ValueError(f"El barco {ship_id} se solapa con otro barco")

        if _touches_occupied(cells, occupied):
            raise ValueError(f"El barco {ship_id} debe tener agua alrededor, no puede tocar otro barco")

        occupied.update(cells)
        placements.append(ShipPlacement(id=ship_id, cells=cells))

    if seen_ids != set(FLEET_SIZES.keys()):
        raise ValueError("Faltan barcos por colocar")

    for placement in placements:
        for row, col in placement.cells:
            board.grid[row][col] = SHIP

    board.ships = placements
    board.ready = True


def attack(board: Board, row: int, col: int) -> str:
    if not (0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE):
        raise ValueError("Coordenadas fuera del tablero")
    if (row, col) in board.shots:
        raise ValueError("Esa celda ya ha sido atacada")

    board.shots.add((row, col))

    for ship in board.ships:
        if (row, col) in ship.cells:
            ship.hits.add((row, col))
            board.grid[row][col] = HIT
            if ship.is_sunk:
                for r, c in ship.cells:
                    board.grid[r][c] = SUNK
                return "sunk"
            return "hit"

    return "water"


def get_sunk_ship(board: Board, row: int, col: int) -> Optional[str]:
    for ship in board.ships:
        if (row, col) in ship.cells and ship.is_sunk:
            return ship.id
    return None


def get_ship_cells(board: Board, ship_id: str) -> Optional[List[Tuple[int, int]]]:
    for ship in board.ships:
        if ship.id == ship_id:
            return ship.cells
    return None


def is_game_over(board: Board) -> bool:
    if not board.ships:
        return False
    return all(ship.is_sunk for ship in board.ships)


def generate_random_ships() -> List[Dict]:
    used: set = set()
    result: List[Dict] = []

    for ship_id, size in FLEET:
        while True:
            horizontal = random.choice([True, False])
            if horizontal:
                row = random.randint(0, BOARD_SIZE - 1)
                col = random.randint(0, BOARD_SIZE - size)
                cells = [(row, col + i) for i in range(size)]
            else:
                row = random.randint(0, BOARD_SIZE - size)
                col = random.randint(0, BOARD_SIZE - 1)
                cells = [(row + i, col) for i in range(size)]

            if not used.intersection(cells) and not _touches_occupied(cells, used):
                used.update(cells)
                result.append({"id": ship_id, "cells": [[r, c] for r, c in cells]})
                break

    return result


class BattleshipAI:
    """Two-mode AI: checkerboard search until a hit, then hunts adjacent cells."""

    def __init__(self) -> None:
        self.mode = "search"
        self.queue: List[Tuple[int, int]] = []
        self.tried: set = set()

    def _valid(self, row: int, col: int) -> bool:
        return 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE and (row, col) not in self.tried

    def choose_target(self) -> Tuple[int, int]:
        while self.mode == "hunt" and self.queue:
            candidate = self.queue.pop(0)
            if self._valid(*candidate):
                return candidate
            self.mode = "hunt" if self.queue else "search"

        self.mode = "search"
        candidates = [
            (r, c)
            for r in range(BOARD_SIZE)
            for c in range(BOARD_SIZE)
            if (r + c) % 2 == 0 and (r, c) not in self.tried
        ]
        if not candidates:
            candidates = [
                (r, c) for r in range(BOARD_SIZE) for c in range(BOARD_SIZE) if (r, c) not in self.tried
            ]
        return random.choice(candidates)

    def register_result(self, row: int, col: int, result: str) -> None:
        self.tried.add((row, col))
        if result == "hit":
            self.mode = "hunt"
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                neighbor = (row + dr, col + dc)
                if self._valid(*neighbor):
                    self.queue.append(neighbor)
        elif result == "sunk":
            self.mode = "search"
            self.queue.clear()
