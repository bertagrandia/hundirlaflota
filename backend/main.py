from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import lobby
import websocket_manager
from config import settings

app = FastAPI(title="Battleship API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    message = errors[0]["msg"] if errors else "Error de validación"
    return JSONResponse(status_code=422, content={"detail": message})


app.include_router(lobby.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.websocket("/ws/{room_code}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, username: str = Query(...)) -> None:
    username = username.strip()
    if not username:
        await websocket.close(code=4401)
        return

    room = lobby.room_manager.get_room(room_code.upper())
    if room is None:
        await websocket.close(code=4404)
        return

    try:
        await websocket_manager.handle_connection(websocket, room, username)
    except WebSocketDisconnect:
        pass
