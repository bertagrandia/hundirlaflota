from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, field_validator

BOARD_SIZE = 10

WATER = 0
SHIP = 1
HIT = 2
SUNK = 3

# (ship_id, size)
FLEET: List[Tuple[str, int]] = [
    ("carrier", 5),
    ("battleship", 4),
    ("cruiser", 3),
    ("submarine", 3),
    ("destroyer", 2),
]

FLEET_SIZES: Dict[str, int] = dict(FLEET)


class RoomStatus(str, Enum):
    WAITING = "waiting"
    PLACEMENT = "placement"
    PLAYING = "playing"
    FINISHED = "finished"


# ---------------------------------------------------------------------------
# Lobby / room schemas
# ---------------------------------------------------------------------------


class NicknameRequest(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 20:
            raise ValueError("El nombre debe tener entre 2 y 20 caracteres")
        if not v.replace(" ", "").isalnum():
            raise ValueError("El nombre solo puede contener letras, números y espacios")
        return v


class RoomCreateResponse(BaseModel):
    code: str
    status: RoomStatus
    player1: str


class RoomJoinResponse(BaseModel):
    code: str
    status: RoomStatus
    player1: str
    player2: Optional[str]


class RoomStateResponse(BaseModel):
    code: str
    status: RoomStatus
    player1: Optional[str]
    player2: Optional[str]
    vs_ai: bool


# ---------------------------------------------------------------------------
# Game domain objects (not pydantic, used internally by game.py)
# ---------------------------------------------------------------------------


@dataclass
class ShipPlacement:
    id: str
    cells: List[Tuple[int, int]]
    hits: Set[Tuple[int, int]] = field(default_factory=set)

    @property
    def is_sunk(self) -> bool:
        return len(self.hits) >= len(self.cells)


@dataclass
class Board:
    grid: List[List[int]] = field(
        default_factory=lambda: [[WATER for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    )
    ships: List[ShipPlacement] = field(default_factory=list)
    shots: Set[Tuple[int, int]] = field(default_factory=set)
    ready: bool = False
