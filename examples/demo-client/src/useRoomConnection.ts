import { MyRoomState } from 'demo-shared/MyRoomState'
import { Client, Room } from '@colyseus/sdk';
import { useEffect, useState } from 'react';

export const useRoomConnection = () => {
  const [room, setRoom] = useState<Room<{ state: MyRoomState }> | null>(null);

    useEffect(() => {
      let joinedRoom: Room<MyRoomState> | null = null;

      const client = new Client('http://localhost:2567');
      client.joinOrCreate<MyRoomState>("my_room", undefined, MyRoomState)
        .then((room) => {
          joinedRoom = room;
          console.log("Joined room:", room.state);
          setRoom(room);
        });

        return () => {
          joinedRoom?.leave();
        }
    }, []);

    return room;
}
