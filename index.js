import express from 'express'
import { Server } from 'socket.io'

const PORT = process.env.PORT || 3500
const ADMIN = 'admin'

const app = express()

const expressServer = app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`)
})

const usersState = {
  users: [],
  setUsers: function (newUsersArray) {
    this.users = newUsersArray
    console.log({ users: this.users, newUsersArray })
  },
}

const localhostURLs = ['http://localhost:5500', '127.0.0.1:5500']

const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? [...localhostURLs, 'https://chat-app-will-lucena.vercel.app']
        : [...localhostURLs],
  },
})

io.on('connection', (socket) => {
  socket.emit('message', buildMessage(ADMIN, 'Welcome to chat app'))

  socket.on('enterRoom', ({ name, room }) => {
    const prevRoom = getUser(socket.id)?.room
    if (prevRoom) {
      socket.leave(prevRoom)
      io.to(prevRoom).emit(
        'message',
        buildMessage(ADMIN, `${name} has left the room`)
      )
    }

    const user = activateUser(socket.id, name, room)
    console.log(user)

    if (prevRoom) {
      io.to(prevRoom).emit('userList', { users: getUsersInRoom(room) })
    }

    socket.join(user.room)

    socket.emit(
      'message',
      buildMessage(ADMIN, `You have joined the ${user.room} chat room`)
    )

    socket.broadcast
      .to(user.room)
      .emit('message', buildMessage(ADMIN, `${user.name} has joined the room`))

    io.to(user.room).emit('userList', {
      users: getUsersInRoom(user.room),
    })

    io.emit('roomList', {
      rooms: getAllActiveRooms(),
    })
  })

  socket.on('disconnect', () => {
    const user = getUser(socket.id)
    userLeavesApp(socket.id)

    if (user) {
      io.to(user.room).emit(
        'message',
        buildMessage(ADMIN, `${user.name} has left the room`)
      )
      io.to(user.room).emit('userList', {
        users: getUsersInRoom(user.room),
      })
      io.emit('roomList', {
        rooms: getAllActiveRooms(),
      })
    }
  })

  socket.on('message', ({ name, text }) => {
    const room = getUser(socket.id)?.room
    if (room) {
      io.to(room).emit('message', buildMessage(name, text))
    }
  })

  socket.on('activity', (name) => {
    const room = getUser(socket.id)?.room

    if (room) {
      socket.broadcast.to(room).emit('activity', name)
    }
  })
})

function buildMessage(name, text) {
  return {
    name,
    text,
    time: new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(new Date()),
  }
}

function activateUser(id, name, room) {
  const user = { id, name, room }
  console.log({ user })
  usersState.setUsers([
    ...usersState.users.filter((user) => user.id !== id),
    user,
  ])
  return user
}

function userLeavesApp(id) {
  usersState.setUsers(usersState.users.filter((user) => user.id !== id))
}

function getUser(id) {
  return usersState.users.find((user) => user.id === id)
}

function getUsersInRoom(room) {
  return usersState.users.filter((user) => user.room === room)
}

function getAllActiveRooms() {
  return Array.from(new Set(usersState.users.map((user) => user.room)))
}
