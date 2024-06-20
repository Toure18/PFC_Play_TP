const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {}
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

const players = [];
const choices = {};
const scores = {};
let currentPlayer = 0;

io.on('connection', (socket) => {
  if (players.length < 2) {
    players.push(socket.id);
    scores[socket.id] = 0;
    if (players.length === 2) {
      io.emit('playerReady');
    }
  } else {
    socket.emit('error', 'Le nombre maximum de joueurs est atteint.');
    socket.disconnect();
    console.log(`Player rejected: ${socket.id}`);
  }

  console.log('a player connected');

  socket.on('playerChoice', (choice) => {
    if (socket.id === players[currentPlayer]) {
      choices[socket.id] = choice;
      console.log(`Player ${socket.id} chose ${choice}`);
      currentPlayer = (currentPlayer + 1) % 2;
      if (Object.keys(choices).length === 2) {
        const results = determineWinner(choices);
        if (results.winner !== 'Draw') {
          scores[results.winner]++;
        }
        io.emit('results', results);
        io.emit('scores', scores);
        // Reset choices for the next round
        Object.keys(choices).forEach(id => delete choices[id]);
        currentPlayer = 0; // Reset to player 1 for next round
      }
    } else {
      socket.emit('error', 'Ce n\'est pas votre tour de jouer.');
    }
  });

  socket.on('chatMessage', (msg) => {
    io.emit('chatMessage', msg);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const index = players.indexOf(socket.id);
    if (index !== -1) {
      players.splice(index, 1);
      delete scores[socket.id];
    }
    console.log('Joueur restant:', players);
    if (players.length < 2) {
      io.emit('error', 'Un joueur a quitté la partie. En attente d\'un autre joueur.');
    }
  });
});

function determineWinner(choices) {
  const [player1, player2] = Object.keys(choices);
  const choice1 = choices[player1];
  const choice2 = choices[player2];

  const winningCombinations = {
    'Pierre': ['Ciseaux', 'Puits'],
    'Feuille': ['Pierre'],
    'Ciseaux': ['Feuille'],
    'Puits': ['Feuille', 'Ciseaux']
  };

  if (choice1 === choice2) {
    return { winner: 'Draw', player1: choice1, player2: choice2 };
  } else if (winningCombinations[choice1].includes(choice2)) {
    return { winner: player1, player1: choice1, player2: choice2 };
  } else {
    return { winner: player2, player1: choice1, player2: choice2 };
  }
}

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
