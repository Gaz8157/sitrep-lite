from __future__ import annotations

import asyncio
import binascii
import json
import socket
import struct
from typing import Any

from ..paths import CONFIG_JSON, SECRETS_FILE, instance_config

RCON_HOST = "127.0.0.1"
RCON_TIMEOUT = 5.0


def _cfg_path(instance_id: int | None = None):
    if instance_id is not None:
        return instance_config(instance_id)
    return CONFIG_JSON


def _get_rcon_port(instance_id: int | None = None) -> int:
    try:
        cfg = json.loads(_cfg_path(instance_id).read_text())
        port = cfg.get("rcon", {}).get("port")
        if isinstance(port, int) and 1 <= port <= 65535:
            return port
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return 19999


def _get_rcon_password(instance_id: int | None = None) -> str:
    try:
        cfg = json.loads(_cfg_path(instance_id).read_text())
        pw = cfg.get("rcon", {}).get("password")
        if isinstance(pw, str) and pw:
            return pw
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    try:
        s = json.loads(SECRETS_FILE.read_text())
        return s.get("rcon_password", "")
    except (OSError, ValueError, json.JSONDecodeError):
        return ""


def _crc32_le(data: bytes) -> bytes:
    return struct.pack("<I", binascii.crc32(data) & 0xFFFFFFFF)


def _build_login(password: str) -> bytes:
    payload = b"\xff\x00" + password.encode("utf-8")
    return b"BE" + _crc32_le(payload) + payload


def _build_command(seq: int, command: str) -> bytes:
    payload = b"\xff\x01" + bytes([seq & 0xFF]) + command.encode("utf-8")
    return b"BE" + _crc32_le(payload) + payload


def _build_message_ack(seq: int) -> bytes:
    payload = b"\xff\x02" + bytes([seq & 0xFF])
    return b"BE" + _crc32_le(payload) + payload


def _parse_packet(packet: bytes) -> tuple[int, int, bytes] | None:
    if len(packet) < 9 or packet[:2] != b"BE":
        return None
    if packet[6] != 0xFF:
        return None
    pkt_type = packet[7]
    if pkt_type == 0x00:
        return (0x00, packet[8], b"")
    if pkt_type == 0x01:
        return (0x01, packet[8], packet[9:])
    if pkt_type == 0x02:
        return (0x02, packet[8], packet[9:])
    return None


async def rcon_call(command: str, *, host: str | None = None,
                    port: int | None = None, password: str | None = None,
                    timeout: float = RCON_TIMEOUT,
                    instance_id: int | None = None) -> str:
    host = host or RCON_HOST
    port = port or _get_rcon_port(instance_id)
    password = password or _get_rcon_password(instance_id)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setblocking(False)
    loop = asyncio.get_running_loop()
    sock.connect((host, port))

    async def _send(data: bytes) -> None:
        await loop.sock_sendall(sock, data)

    try:
        await _send(_build_login(password))
        resp = await asyncio.wait_for(loop.sock_recv(sock, 4096), timeout)
        parsed = _parse_packet(resp)
        if parsed is None or parsed[0] != 0x00 or parsed[1] != 0x01:
            raise RuntimeError("RCON login failed (wrong password?)")

        while True:
            try:
                pre = await asyncio.wait_for(loop.sock_recv(sock, 4096), 0.3)
            except asyncio.TimeoutError:
                break
            pp = _parse_packet(pre)
            if pp is not None and pp[0] == 0x02:
                await _send(_build_message_ack(pp[1]))

        await _send(_build_command(0, command))

        chunks: dict[int, bytes] = {}
        expected_total: int | None = None
        body = b""
        single_packet = False

        while True:
            try:
                resp = await asyncio.wait_for(loop.sock_recv(sock, 4096), 1.0)
            except asyncio.TimeoutError:
                break
            p = _parse_packet(resp)
            if p is None:
                continue
            if p[0] == 0x02:
                await _send(_build_message_ack(p[1]))
                continue
            if p[0] != 0x01:
                continue
            chunk = p[2]
            if len(chunk) >= 3 and chunk[0] == 0x00:
                total = chunk[1]
                index = chunk[2]
                chunks[index] = chunk[3:]
                expected_total = total
                if len(chunks) >= total:
                    break
            else:
                body = chunk
                single_packet = True
                break

        if not single_packet and expected_total is not None:
            body = b"".join(chunks[i] for i in sorted(chunks.keys()))

        return body.decode("utf-8", errors="replace")
    finally:
        sock.close()
