import { Server, Socket } from "https://deno.land/x/socket_io@0.2.1/mod.ts";
import { Room } from "../models/room.ts";
import { randomUUID } from "node:crypto";
import {
  Mahjong,
  MahjongInput,
  MahjongInputParams,
} from "../models/mahjong.ts";

export const OnAll = (socket: Socket, rooms: { [key: string]: Room }) => {
  OnJoin(socket, rooms);
  OnLeave(socket, rooms);
  OnDisconnect(socket, rooms);
  OnInput(socket, rooms);
};

const OnInput = (socket: Socket, rooms: { [key: string]: Room }) => {
  socket.on(
    "input",
    (name: string, input: MahjongInput, params: MahjongInputParams) => {
      const room = rooms[name];
      room.input(socket.id, input, params);
    },
  );
};

const OnJoin = (socket: Socket, rooms: { [key: string]: Room }) => {
  socket.on("join", async () => {
    let name = "";
    for (const [key, room] of Object.entries(rooms)) {
      if (room.isOpen()) {
        name = key;
        break;
      }
    }
    if (name == "") {
      name = randomUUID();
    }
    await socket.join(name);
  });
};

const OnLeave = (socket: Socket, _: { [key: string]: Room }) => {
  socket.on("leave", async (name) => {
    await socket.leave(name);
  });
};

const OnDisconnect = (socket: Socket, _: { [key: string]: Room }) => {
  socket.on("disconnect", () => {});
};

export const OnServerConnection = (
  io: Server,
  rooms: { [key: string]: Room },
) => {
  io.on("connection", (socket: Socket) => {
    OnAll(socket, rooms);
  });
};

export const OnServerJoinRoom = (
  io: Server,
  rooms: { [key: string]: Room },
) => {
  io.of("/").adapter.on("join-room", (name: string | number, id: string) => {
    if (name != id) {
      let room = rooms[name.toString()];
      if (room == undefined) {
        room = new Room();
        rooms[name.toString()] = room;
      }
      room.join(id);

      if (room.size() == 4) {
        const output = (mjg: Mahjong) => {
          io.to(name.toString()).emit("output", mjg);
        };
        room.start(output);
      }
    }
  });
};

export const OnServerLeaveRoom = (
  io: Server,
  rooms: { [key: string]: Room },
) => {
  io.of("/").adapter.on("leave-room", (name: string | number, id: string) => {
    if (name != id && name in rooms) {
      const room = rooms[name];
      room.leave(id);
      if (room.size() == 0) {
        delete rooms[name];
      }
    }
  });
};
