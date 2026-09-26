import { Chess } from 'chess.js';

const game = new Chess();
const boardElement = document.querySelector('#board');
const moveListElement = document.querySelector('#move-list');
const moveCountElement = document.querySelector('#move-count');
const turnLabelElement = document.querySelector('#turn-label');
const turnDetailElement = document.querySelector('#turn-detail');
const turnPieceElement = document.querySelector('#turn-piece');
const turnIndicatorElement = document.querySelector('#turn-indicator');
const promotionDialog = document.querySelector('#promotion-dialog');
const promotionOptions = document.querySelector('#promotion-options');
const pieceSymbols = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const files = 'abcdefgh';
const humanColor = 'w';
const computerColor = 'b';
const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
let selectedSquare = null;
let legalTargets = [];
let flipped = false;
let lastMove = null;
let draggedFrom = null;
let gameMode = 'computer';
let computerThinking = false;

function updateModeButtons() {
  document.querySelectorAll('.mode-button').forEach((button) => {
    const active = button.dataset.mode === gameMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function isLocalGame() {
  return gameMode === 'local';
}

function canHumanMove() {
  return !game.isGameOver() && !computerThinking && (isLocalGame() || game.turn() === humanColor);
}

function renderBoard() {
  const board = game.board();
  const ranks = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileOrder = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const legalTargetSquares = new Set(legalTargets.map((move) => move.to));
  const captureTargets = new Set(legalTargets.filter((move) => move.captured || move.flags.includes('e')).map((move) => move.to));
  boardElement.replaceChildren();

  ranks.forEach((rank, rowIndex) => {
    fileOrder.forEach((fileIndex, columnIndex) => {
      const squareName = `${files[fileIndex]}${8 - rank}`;
      const piece = board[rank][fileIndex];
      const square = document.createElement('button');
      const isLight = (rank + fileIndex) % 2 === 1;
      square.type = 'button';
      square.className = `square ${isLight ? 'light' : 'dark'}`;
      square.setAttribute('role', 'gridcell');
      square.setAttribute('aria-label', `${squareName}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`);
      if (squareName === selectedSquare) square.classList.add('selected');
      if (lastMove && (squareName === lastMove.from || squareName === lastMove.to)) square.classList.add('last-move');
      if (legalTargetSquares.has(squareName)) square.classList.add(captureTargets.has(squareName) ? 'legal-capture' : 'legal-target');

      if (piece) {
        const pieceElement = document.createElement('span');
        pieceElement.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
        pieceElement.textContent = pieceSymbols[piece.color][piece.type];
        pieceElement.setAttribute('aria-hidden', 'true');
        square.append(pieceElement);

        const isMovablePiece = piece.color === game.turn() && canHumanMove();
        square.draggable = isMovablePiece;
        square.addEventListener('dragstart', (event) => {
          if (!canHumanMove() || piece.color !== game.turn()) {
            event.preventDefault();
            return;
          }
          draggedFrom = squareName;
          selectedSquare = squareName;
          legalTargets = game.moves({ square: squareName, verbose: true });
          event.dataTransfer.setData('text/plain', squareName);
          event.dataTransfer.effectAllowed = 'move';
          requestAnimationFrame(renderBoard);
        });
        square.addEventListener('dragend', () => {
          draggedFrom = null;
          renderBoard();
        });
      }

      if ((flipped ? rowIndex === 7 : rowIndex === 0)) {
        const fileLabel = document.createElement('span');
        fileLabel.className = 'coord file';
        fileLabel.textContent = files[fileIndex];
        square.append(fileLabel);
      }
      if (columnIndex === 0) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'coord rank';
        rankLabel.textContent = String(8 - rank);
        square.append(rankLabel);
      }

      square.addEventListener('click', () => handleSquareClick(squareName));
      square.addEventListener('dragover', (event) => {
        if (canHumanMove()) event.preventDefault();
      });
      square.addEventListener('drop', (event) => {
        event.preventDefault();
        if (!canHumanMove()) return;
        const source = draggedFrom || event.dataTransfer.getData('text/plain');
        if (source) tryMove(source, squareName);
      });
      boardElement.append(square);
    });
  });
}

function handleSquareClick(squareName) {
  if (!canHumanMove()) return;
  const piece = game.get(squareName);
  if (selectedSquare && legalTargets.some((move) => move.to === squareName)) {
    tryMove(selectedSquare, squareName);
    return;
  }
  if (piece && piece.color === game.turn()) {
    selectedSquare = squareName;
    legalTargets = game.moves({ square: squareName, verbose: true });
  } else {
    selectedSquare = null;
    legalTargets = [];
  }
  renderBoard();
}

function tryMove(from, to) {
  const matchingMove = legalTargets.find((move) => move.to === to && move.from === from);
  if (!matchingMove) {
    selectedSquare = null;
    legalTargets = [];
    renderBoard();
    return;
  }
  if (matchingMove.flags.includes('p')) {
    showPromotionChoices(from, to);
    return;
  }
  commitMove(from, to);
}

function showPromotionChoices(from, to) {
  const color = game.turn();
  promotionOptions.replaceChildren();
  ['q', 'r', 'b', 'n'].forEach((type) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'promotion-choice';
    button.textContent = pieceSymbols[color][type];
    button.setAttribute('aria-label', `Promote to ${({ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' })[type]}`);
    button.addEventListener('click', () => {
      promotionDialog.close();
      commitMove(from, to, type);
    });
    promotionOptions.append(button);
  });
  promotionDialog.showModal();
}

function commitMove(from, to, promotion) {
  const move = game.move({ from, to, ...(promotion ? { promotion } : {}) });
  if (!move) return;
  lastMove = { from: move.from, to: move.to };
  selectedSquare = null;
  legalTargets = [];
  render();
}

function evaluateBoard() {
  const board = game.board();
  let score = 0;
  board.flat().forEach((piece) => {
    if (!piece) return;
    const base = pieceValues[piece.type];
    score += piece.color === 'b' ? base : -base;
    if (piece.type !== 'p' && piece.type !== 'k') {
      const centerBias = piece.square ? [3, 4].includes(piece.square.charCodeAt(0) - 97) || [3, 4].includes(Number(piece.square[1])) : false;
      if (centerBias) score += piece.color === 'b' ? 6 : -6;
    }
  });
  return score;
}

function minimax(depth, alpha, beta) {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard();
  }

  const moves = game.moves({ verbose: true });
  if (!moves.length) {
    return game.isCheck() ? (game.turn() === 'b' ? -99999 + depth : 99999 - depth) : 0;
  }

  if (game.turn() === 'b') {
    let best = -Infinity;
    for (const move of moves) {
      game.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
      const score = minimax(depth - 1, alpha, beta);
      game.undo();
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    game.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    const score = minimax(depth - 1, alpha, beta);
    game.undo();
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) break;
  }
  return best;
}

function chooseComputerMove() {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const promotion = move.promotion || 'q';
    game.move({ from: move.from, to: move.to, promotion });
    const score = minimax(2, -Infinity, Infinity);
    game.undo();

    const centerPriority = ((move.to[0] === 'd' || move.to[0] === 'e') && (move.to[1] === '4' || move.to[1] === '5')) ? 12 : 0;
    const captureBonus = move.captured ? pieceValues[move.captured] * 0.25 : 0;
    const total = score + centerPriority + captureBonus;

    if (total > bestScore) {
      bestScore = total;
      bestMove = move;
    }
  }

  return bestMove;
}

function maybeTriggerComputerMove() {
  if (gameMode !== 'computer' || computerThinking || game.isGameOver() || game.turn() !== computerColor) return;

  computerThinking = true;
  render();

  window.setTimeout(() => {
    const bestMove = chooseComputerMove();
    computerThinking = false;

    if (!bestMove) {
      render();
      return;
    }

    const move = game.move({ from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion || 'q' });
    if (move) {
      lastMove = { from: move.from, to: move.to };
      selectedSquare = null;
      legalTargets = [];
    }
    render();
  }, 420);
}

function renderPlayers() {
  const whiteActive = game.turn() === 'w' && !game.isGameOver();
  const blackActive = game.turn() === 'b' && !game.isGameOver();
  document.querySelector('#white-player').classList.toggle('active', whiteActive);
  document.querySelector('#black-player').classList.toggle('active', blackActive);

  const history = game.history({ verbose: true });
  const captured = { w: [], b: [] };
  history.forEach((move) => {
    if (move.captured) captured[move.color].push(pieceSymbols[move.color === 'w' ? 'b' : 'w'][move.captured]);
  });
  document.querySelector('#white-captured').replaceChildren(...captured.w.map(createCapturedPiece));
  document.querySelector('#black-captured').replaceChildren(...captured.b.map(createCapturedPiece));
}

function createCapturedPiece(symbol) {
  const piece = document.createElement('span');
  piece.className = 'captured-piece';
  piece.textContent = symbol;
  piece.setAttribute('aria-hidden', 'true');
  return piece;
}

function renderMoves() {
  const history = game.history();
  const fullMoveCount = Math.ceil(history.length / 2);
  moveCountElement.textContent = `${fullMoveCount} ${fullMoveCount === 1 ? 'move' : 'moves'}`;
  if (!history.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-history';
    emptyState.innerHTML = '<span aria-hidden="true">↗</span><span>Your game begins here.</span>';
    moveListElement.replaceChildren(emptyState);
    return;
  }

  const entries = [];
  for (let index = 0; index < history.length; index += 2) {
    const row = document.createElement('div');
    row.className = `move-entry${index + 2 >= history.length ? ' recent' : ''}`;
    const number = document.createElement('span');
    number.className = 'move-number';
    number.textContent = `${Math.floor(index / 2) + 1}.`;
    row.append(number);
    [history[index], history[index + 1]].forEach((notation, sideIndex) => {
      const cell = document.createElement('span');
      cell.className = `move-san${index + sideIndex === history.length - 1 ? ' latest' : ''}`;
      cell.textContent = notation || '';
      row.append(cell);
    });
    entries.push(row);
  }
  moveListElement.replaceChildren(...entries);
  moveListElement.scrollTop = moveListElement.scrollHeight;
}

function renderStatus() {
  const side = game.turn() === 'w' ? 'White' : 'Black';
  const symbol = game.turn() === 'w' ? '♔' : '♚';
  const over = game.isGameOver();
  turnPieceElement.textContent = symbol;
  turnIndicatorElement.classList.toggle('in-check', !over && game.isCheck());

  if (game.isCheckmate()) {
    turnLabelElement.textContent = `${side} is checkmated`;
    turnDetailElement.textContent = `${side === 'White' ? 'Black' : 'White'} wins`;
  } else if (game.isStalemate()) {
    turnLabelElement.textContent = 'Draw by stalemate';
    turnDetailElement.textContent = 'Neither side can move';
  } else if (game.isThreefoldRepetition()) {
    turnLabelElement.textContent = 'Draw by repetition';
    turnDetailElement.textContent = 'Position repeated three times';
  } else if (game.isInsufficientMaterial()) {
    turnLabelElement.textContent = 'Draw by material';
    turnDetailElement.textContent = 'Not enough pieces to checkmate';
  } else if (game.isDraw()) {
    turnLabelElement.textContent = 'Game drawn';
    turnDetailElement.textContent = 'Draw agreed by position';
  } else if (game.isCheck()) {
    turnLabelElement.textContent = `${side} is in check`;
    turnDetailElement.textContent = 'Find a way to protect your king';
  } else if (gameMode === 'computer' && game.turn() === computerColor) {
    turnLabelElement.textContent = 'Computer to move';
    turnDetailElement.textContent = computerThinking ? 'Calculating...' : 'Thinking through the next move';
  } else if (gameMode === 'computer') {
    turnLabelElement.textContent = 'Your turn';
    turnDetailElement.textContent = game.history().length ? 'Make the next move' : 'Make your opening move';
  } else {
    turnLabelElement.textContent = `${side} to move`;
    turnDetailElement.textContent = game.history().length ? 'The board is yours' : 'Make your opening move';
  }
}

function render() {
  renderBoard();
  renderPlayers();
  renderMoves();
  renderStatus();
  document.querySelector('#undo-move').disabled = game.history().length === 0 || computerThinking;
  updateModeButtons();
  maybeTriggerComputerMove();
}

function resetGame() {
  game.reset();
  selectedSquare = null;
  legalTargets = [];
  lastMove = null;
  computerThinking = false;
  promotionDialog.close();
  render();
}

document.querySelector('#new-game').addEventListener('click', () => {
  resetGame();
});
document.querySelector('#undo-move').addEventListener('click', () => {
  if (computerThinking) return;
  const undone = game.undo();
  if (undone) lastMove = game.history({ verbose: true }).at(-1) || null;
  selectedSquare = null;
  legalTargets = [];
  render();
});
document.querySelector('#flip-board').addEventListener('click', () => {
  flipped = !flipped;
  renderBoard();
});
document.querySelectorAll('.mode-button').forEach((button) => {
  button.addEventListener('click', () => {
    gameMode = button.dataset.mode;
    resetGame();
  });
});
promotionDialog.addEventListener('click', (event) => {
  if (event.target === promotionDialog) promotionDialog.close();
});

resetGame();
