
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Difficulty, GameState, Tile, Character, ChatMessage } from './types';
import { CHARACTERS } from './constants';
import { createDeck, shuffle, canPlay, getAIMove, calculateScore, getValidMoves, findStartingInfo, getPossiblePlacements } from './logic/gameLogic';
import { DominoTile } from './components/DominoTile';
import { getAIResponse } from './services/geminiService';

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [selectedTargetScore, setSelectedTargetScore] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [startingTile, setStartingTile] = useState<Tile | null>(null);
  const [showEndReview, setShowEndReview] = useState(false);
  const [roundPoints, setRoundPoints] = useState<{player: number, ai: number} | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{tile: Tile, index: number} | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const character = difficulty ? CHARACTERS[difficulty] : null;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping]);

  const addAction = (currentActions: string[], newAction: string): string[] => {
    return [...currentActions, newAction].slice(-3);
  };

  const handleChat = async (message: string, isSystem = false) => {
    if (!character || (!message.trim() && !isSystem)) return;

    if (!isSystem) {
      setChatMessages(prev => [...prev, { role: 'user', text: message }]);
      setUserInput('');
    }

    setIsTyping(true);
    const context = gameState 
      ? `Score: Toi ${gameState.playerScore}, Moi ${gameState.aiScore}. Cible: ${gameState.targetScore}. Ton adversaire vient de ${isSystem ? 'faire une action de jeu' : 'te parler'}.`
      : `Début du match.`;

    const response = await getAIResponse(character, isSystem ? `[ACTION] ${message}` : message, chatMessages, context);
    setIsTyping(false);
    setChatMessages(prev => [...prev, { role: 'model', text: response }]);
  };

  const startNewGame = (diff: Difficulty, target: number) => {
    const deck = shuffle(createDeck());
    const playerHand = deck.splice(0, 7);
    const aiHand = deck.splice(0, 7);
    const boneyard = deck;
    const aiName = CHARACTERS[diff].name;
    const starterInfo = findStartingInfo(playerHand, aiHand, aiName);

    setDifficulty(diff);
    setSelectedTargetScore(target);
    setShowEndReview(false);
    setRoundPoints(null);
    setStartingTile(starterInfo.startingTile);
    setGameState({
      playerHand,
      aiHand,
      board: [],
      boneyard,
      currentPlayer: starterInfo.player,
      playerScore: 0,
      aiScore: 0,
      targetScore: target,
      isGameOver: false,
      winner: null,
      actions: [starterInfo.message]
    });
    setChatMessages([]);
    setTimeout(() => handleChat(`Salut ! Je suis prêt pour ce défi en ${target} points !`, true), 500);
  };

  const isMatchFinished = useMemo(() => {
    if (!gameState) return false;
    return gameState.playerScore >= gameState.targetScore || gameState.aiScore >= gameState.targetScore;
  }, [gameState?.playerScore, gameState?.aiScore, gameState?.targetScore]);

  const endRound = (roundWinner: 'player' | 'ai' | 'blocked') => {
    setShowEndReview(true);
    
    setGameState(prev => {
      if (!prev) return null;
      
      let pGain = 0;
      let aGain = 0;

      if (roundWinner === 'player') {
        pGain = calculateScore(prev.aiHand);
      } else if (roundWinner === 'ai') {
        aGain = calculateScore(prev.playerHand);
      } else if (roundWinner === 'blocked') {
        const pHandScore = calculateScore(prev.playerHand);
        const aHandScore = calculateScore(prev.aiHand);
        if (pHandScore < aHandScore) pGain = aHandScore;
        else if (aHandScore < pHandScore) aGain = pHandScore;
      }
      
      setRoundPoints({ player: pGain, ai: aGain });
      
      const newPlayerScore = prev.playerScore + pGain;
      const newAiScore = prev.aiScore + aGain;
      const matchOver = newPlayerScore >= prev.targetScore || newAiScore >= prev.targetScore;
      
      let finalWinner: 'player' | 'ai' | null = null;
      if (matchOver) {
        finalWinner = newPlayerScore > newAiScore ? 'player' : 'ai';
      }

      const endMsg = roundWinner === 'blocked' ? "Round bloqué !" : (roundWinner === 'player' ? 'Tu as gagné le round !' : 'J\'ai gagné le round !');
      
      return {
        ...prev,
        playerScore: newPlayerScore,
        aiScore: newAiScore,
        currentPlayer: 'player', 
        winner: finalWinner,
        actions: addAction(prev.actions, endMsg)
      };
    });

    const eventMsg = roundWinner === 'blocked' 
      ? "C'est bloqué ! Regardons les points restants." 
      : (roundWinner === 'player' 
          ? "Bien joué pour ce round !" 
          : "Et d'un round pour moi !");
    
    setTimeout(() => handleChat(eventMsg, true), 800);
  };

  const triggerGameOver = () => {
    setTimeout(() => {
      setGameState(prev => prev ? ({ ...prev, isGameOver: true }) : null);
    }, 4000);
  };

  const handleNextRound = useCallback(() => {
    if (!gameState || !character || gameState.isGameOver) return;
    const deck = shuffle(createDeck());
    const playerHand = deck.splice(0, 7);
    const aiHand = deck.splice(0, 7);
    const boneyard = deck;
    const starterInfo = findStartingInfo(playerHand, aiHand, character.name);

    setShowEndReview(false);
    setRoundPoints(null);
    setStartingTile(starterInfo.startingTile);
    setGameState(prev => prev ? ({
      ...prev,
      playerHand, aiHand, board: [], boneyard, currentPlayer: starterInfo.player,
      actions: addAction(prev.actions, `Nouveau round : ${starterInfo.message}`)
    }) : null);
    handleChat("Nouveau round ! Sois prêt.", true);
  }, [gameState, character]);

  const handleDraw = () => {
    if (!gameState || gameState.currentPlayer !== 'player' || gameState.boneyard.length === 0 || showEndReview || gameState.isGameOver) return;
    if (getValidMoves(gameState.playerHand, gameState.board).length > 0) {
       handleChat("Hé ! Tu as encore des options, pas besoin de piocher.", true);
       return;
    }

    setGameState(prev => {
      if (!prev) return null;
      const newBoneyard = [...prev.boneyard];
      const drawnTile = newBoneyard.pop()!;
      return {
        ...prev,
        playerHand: [...prev.playerHand, drawnTile],
        boneyard: newBoneyard,
        actions: addAction(prev.actions, "Tu as pioché.")
      };
    });
    handleChat("Tu pioches ? C'est bon signe pour moi ça !", true);
  };

  const applyPlacement = (tile: Tile, index: number, position: 'start' | 'end') => {
    setGameState(prev => {
      if (!prev || prev.isGameOver || showEndReview) return null;
      const newBoard = [...prev.board];
      const newHand = [...prev.playerHand];
      newHand.splice(index, 1);
      
      let placedTile = [...tile] as Tile;
      if (position === 'start') {
        if (newBoard.length > 0 && placedTile[1] !== newBoard[0][0]) placedTile = [placedTile[1], placedTile[0]];
        newBoard.unshift(placedTile);
      } else {
        if (newBoard.length > 0 && placedTile[0] !== newBoard[newBoard.length - 1][1]) placedTile = [placedTile[1], placedTile[0]];
        newBoard.push(placedTile);
      }
      
      if (newHand.length === 0) setTimeout(() => endRound('player'), 300);
      return { ...prev, playerHand: newHand, board: newBoard, currentPlayer: 'ai', actions: addAction(prev.actions, "Coup joué.") };
    });
    setPendingPlacement(null);
  };

  const playTile = (tileIndex: number) => {
    if (!gameState || gameState.currentPlayer !== 'player' || showEndReview || gameState.isGameOver) return;
    const tile = gameState.playerHand[tileIndex];
    if (gameState.board.length === 0 && startingTile) {
      if (tile[0] !== startingTile[0] || tile[1] !== startingTile[1]) return;
    }
    const possible = getPossiblePlacements(tile, gameState.board);
    if (possible.length === 0) return;
    if (possible.length > 1) setPendingPlacement({ tile, index: tileIndex });
    else applyPlacement(tile, tileIndex, possible[0]);
  };

  const executeAIMove = useCallback(() => {
    if (!gameState || gameState.currentPlayer !== 'ai' || gameState.isGameOver || showEndReview) return;

    setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.currentPlayer !== 'ai' || prev.isGameOver || showEndReview) return prev;
        if (prev.board.length === 0 && startingTile) {
          const newHand = [...prev.aiHand];
          const idx = newHand.findIndex(t => (t[0] === startingTile[0] && t[1] === startingTile[1]) || (t[0] === startingTile[1] && t[1] === startingTile[0]));
          if (idx === -1) return prev;
          newHand.splice(idx, 1);
          return { ...prev, aiHand: newHand, board: [startingTile], currentPlayer: 'player', actions: addAction(prev.actions, `${character?.name} commence.`) };
        }

        let currentHand = [...prev.aiHand];
        let currentBoneyard = [...prev.boneyard];
        let move = getAIMove(currentHand, prev.board, difficulty!);
        while (!move && currentBoneyard.length > 0) {
          const drawn = currentBoneyard.pop()!;
          currentHand.push(drawn);
          move = getAIMove(currentHand, prev.board, difficulty!);
        }

        if (move) {
          const newBoard = [...prev.board];
          const newHand = [...currentHand];
          const tileIdx = newHand.findIndex(t => t[0] === move.tile[0] && t[1] === move.tile[1]);
          newHand.splice(tileIdx, 1);
          let placedTile = [...move.tile] as Tile;
          if (move.position === 'start') {
            if (newBoard.length > 0 && placedTile[1] !== newBoard[0][0]) placedTile = [placedTile[1], placedTile[0]];
            newBoard.unshift(placedTile);
          } else {
            if (newBoard.length > 0 && placedTile[0] !== newBoard[newBoard.length - 1][1]) placedTile = [placedTile[1], placedTile[0]];
            newBoard.push(placedTile);
          }
          if (newHand.length === 0) {
            setTimeout(() => endRound('ai'), 300);
            return { ...prev, aiHand: newHand, board: newBoard, boneyard: currentBoneyard, currentPlayer: 'player', actions: addAction(prev.actions, `${character?.name} a fini le round !`) };
          }
          return { ...prev, aiHand: newHand, board: newBoard, boneyard: currentBoneyard, currentPlayer: 'player', actions: addAction(prev.actions, `${character?.name} a joué.`) };
        } else {
          const playerMoves = getValidMoves(prev.playerHand, prev.board);
          if (playerMoves.length === 0) {
            setTimeout(() => endRound('blocked'), 100);
            return { ...prev, aiHand: currentHand, boneyard: currentBoneyard };
          }
          return { ...prev, aiHand: currentHand, boneyard: currentBoneyard, currentPlayer: 'player', actions: addAction(prev.actions, `${character?.name} passe.`) };
        }
      });
    }, 1200);
  }, [gameState?.currentPlayer, difficulty, character, startingTile, showEndReview, gameState?.isGameOver]);

  useEffect(() => {
    if (gameState?.currentPlayer === 'ai' && !gameState.isGameOver && !showEndReview) executeAIMove();
  }, [gameState?.currentPlayer, executeAIMove, gameState?.isGameOver, showEndReview]);

  // Échelle dynamique pour que tout le plateau soit visible en une ligne
  const boardScale = useMemo(() => {
    if (!gameState || gameState.board.length < 8) return 1;
    // On réduit l'échelle proportionnellement au nombre de dominos
    const scale = Math.max(0.2, 1 - (gameState.board.length - 8) * 0.04);
    return scale;
  }, [gameState?.board.length]);

  if (!difficulty || !selectedTargetScore) {
    return (
      <div className="min-h-screen paper-grid flex flex-col items-center justify-center p-6 overflow-hidden relative no-red-line">
        <div className="z-10 text-center flex flex-col items-center">
          <h1 className="text-6xl md:text-8xl font-sketch text-blue-600 mb-2 transform -rotate-2">DOMINO CLASH</h1>
          <p className="text-xl md:text-2xl font-sketch text-gray-400 mb-8 italic">"Sur ton cahier, la bataille fait rage."</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
            {(Object.values(CHARACTERS) as Character[]).map((char) => (
              <div key={char.difficulty} className="group bg-white border-4 border-dashed rounded-3xl p-6 flex flex-col items-center transition-all duration-300 hover:rotate-1 cursor-pointer shadow-lg hover:shadow-2xl" onClick={() => setDifficulty(char.difficulty)}>
                <img src={char.avatar} alt={char.name} className="w-40 h-40 rounded-full mb-4 object-cover border-4 border-white shadow-md transform group-hover:scale-110 transition-transform" />
                <h2 className={`text-4xl font-sketch ${char.difficulty === Difficulty.EASY ? 'text-pink-500' : 'text-gray-800'}`}>{char.name}</h2>
                <div className={`mt-6 w-full py-3 ${char.difficulty === Difficulty.EASY ? 'bg-pink-400' : 'bg-blue-500'} text-white font-sketch text-xl rounded-2xl`}>AFFRONTER</div>
              </div>
            ))}
          </div>
          {difficulty && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white p-12 border-4 border-dashed border-blue-200 rounded-3xl flex flex-col items-center max-w-lg shadow-xl animate-in zoom-in duration-300">
                <h2 className="text-4xl font-sketch mb-8 text-blue-500">Combien de points ?</h2>
                <div className="flex gap-4">
                  {[25, 50, 100].map(val => (
                    <button key={val} onClick={() => startNewGame(difficulty, val)} className="w-24 h-24 rounded-full border-4 border-blue-400 text-4xl font-sketch hover:bg-blue-400 hover:text-white transition-all flex items-center justify-center">{val}</button>
                  ))}
                </div>
                <button onClick={() => setDifficulty(null)} className="mt-8 text-gray-300 font-sketch text-xl underline hover:text-red-400">Retour</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden paper-grid relative no-red-line">
      {/* Header HUD */}
      <div className="bg-white/98 border-b-2 border-blue-100 p-4 flex justify-between items-center z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={() => { setDifficulty(null); setSelectedTargetScore(null); }} className="font-sketch text-xl text-red-500 hover:scale-110 transition-transform">← QUITTER</button>
          <h1 className="text-3xl font-sketch text-blue-500 tracking-wide">DOMINO CLASH</h1>
        </div>
        <div className="flex gap-8 items-center font-sketch text-2xl">
          <div className="text-center">
            <p className="text-[10px] text-gray-400 uppercase font-black">Score Toi</p>
            <p className="font-bold text-gray-800">{gameState?.playerScore} <span className="text-gray-300 text-sm">/ {gameState?.targetScore}</span></p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400 uppercase font-black">Score {character.name}</p>
            <p className={`font-bold ${character.difficulty === Difficulty.HARD ? 'text-purple-600' : 'text-orange-500'}`}>{gameState?.aiScore} <span className="text-gray-300 text-sm">/ {gameState?.targetScore}</span></p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Plateau de jeu */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-40">
            <div className="flex gap-1 p-2 bg-white/40 backdrop-blur-sm rounded-2xl border border-dashed border-gray-100">
              {gameState?.aiHand.map((tile, i) => (
                <DominoTile key={i} tile={tile} backside={!showEndReview} vertical className="scale-75 origin-top" themeClass={character.tileStyle} />
              ))}
            </div>
          </div>

          <div ref={boardRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
            <div 
              id="board-container" 
              className="flex flex-nowrap items-center justify-center gap-1 p-10 transition-transform duration-700 max-w-full"
              style={{ transform: `scale(${boardScale})` }}
            >
              {gameState?.board.map((tile, i) => (
                <DominoTile 
                  key={`${i}-${tile[0]}-${tile[1]}`} 
                  tile={tile} 
                  disabled 
                  vertical={tile[0] === tile[1]} 
                  className="tile-placed-animation shadow-sm border-2 border-slate-600" 
                  themeClass={character.tileStyle} 
                />
              ))}
            </div>
          </div>

          {pendingPlacement && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-white/95 p-10 rounded-[40px] border-4 border-dashed border-blue-400 shadow-2xl flex flex-col items-center animate-in zoom-in duration-300">
              <p className="font-sketch text-4xl mb-8 text-gray-800">Où poser le domino ?</p>
              <div className="flex gap-8">
                <button onClick={() => applyPlacement(pendingPlacement.tile, pendingPlacement.index, 'start')} className="px-10 py-5 bg-blue-500 text-white rounded-3xl font-sketch text-3xl hover:scale-110 shadow-lg border-b-8 border-blue-700">À GAUCHE</button>
                <button onClick={() => applyPlacement(pendingPlacement.tile, pendingPlacement.index, 'end')} className="px-10 py-5 bg-blue-500 text-white rounded-3xl font-sketch text-3xl hover:scale-110 shadow-lg border-b-8 border-blue-700">À DROITE</button>
              </div>
            </div>
          )}

          <div className="bg-blue-50/90 p-8 border-t-4 border-dashed border-blue-100 z-50">
            <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
              <div className="bg-white/50 p-4 rounded-2xl border border-blue-100 min-w-[350px]">
                <span className="text-[10px] text-blue-400 uppercase font-black">Cahier de notes</span>
                <div className="flex flex-col gap-1 mt-1">
                  {gameState?.actions.map((act, i) => (
                    <p key={i} className={`font-sketch text-gray-600 italic ${i === gameState.actions.length - 1 ? 'text-2xl opacity-100' : 'text-lg opacity-40'}`}>{act}</p>
                  ))}
                </div>
              </div>
              <div className="flex gap-6 items-center">
                 <button onClick={handleDraw} disabled={!gameState || (getValidMoves(gameState.playerHand, gameState.board).length > 0) || gameState.boneyard.length === 0 || showEndReview || gameState.isGameOver} className={`w-24 h-24 bg-white rounded-3xl border-4 border-blue-400 flex flex-col items-center justify-center transition-all ${gameState && getValidMoves(gameState.playerHand, gameState.board).length === 0 && gameState.boneyard.length > 0 && !showEndReview ? 'pulse-draw' : 'opacity-20'}`}>
                   <span className="text-3xl font-bold text-blue-500">{gameState?.boneyard.length}</span>
                   <span className="font-sketch text-blue-300 text-sm">PIOCHE</span>
                 </button>
                 {showEndReview && !gameState?.isGameOver && (
                    isMatchFinished ? (
                      <button onClick={triggerGameOver} className="px-12 py-6 bg-red-500 text-white rounded-3xl font-sketch text-4xl shadow-xl hover:scale-110 border-b-8 border-red-700 animate-pulse">FINIR LA PARTIE</button>
                    ) : (
                      <button onClick={handleNextRound} className="px-12 py-6 bg-green-500 text-white rounded-3xl font-sketch text-4xl shadow-xl hover:scale-110 border-b-8 border-green-700">ROUND SUIVANT</button>
                    )
                 )}
              </div>
            </div>
            <div className="flex justify-center gap-4 overflow-x-auto pb-8 pt-2 max-w-7xl mx-auto scrollbar-hide">
              {gameState?.playerHand.map((tile, i) => {
                let playable = getPossiblePlacements(tile, gameState.board).length > 0;
                if (gameState.board.length === 0 && startingTile) playable = (tile[0] === startingTile[0] && tile[1] === startingTile[1]);
                const isTurn = gameState.currentPlayer === 'player' && !showEndReview && !gameState.isGameOver;
                return (
                  <DominoTile key={i} tile={tile} vertical onClick={() => playTile(i)} disabled={!isTurn || !playable} className={!playable ? 'grayscale opacity-30' : 'tile-dance'} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Panneau de Chat AI */}
        <div className="w-80 md:w-96 bg-white border-l-2 border-blue-50 flex flex-col z-50 shadow-2xl paper-grid no-red-line overflow-hidden">
          <div className="p-8 border-b-2 border-blue-50 bg-blue-50/20 flex items-center gap-4">
            <img src={character.avatar} alt={character.name} className="w-20 h-20 rounded-3xl object-cover border-4 border-white transform -rotate-3 shadow-md" />
            <p className="text-3xl font-sketch leading-tight">{character.name}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[95%] px-5 py-4 font-sketch text-xl border-2 ${msg.role === 'user' ? 'bg-blue-500 text-white border-blue-600 rounded-2xl rounded-tr-none shadow-sm' : 'bg-white text-gray-700 border-gray-100 rounded-2xl rounded-tl-none transform -rotate-1 shadow-sm'}`}>{msg.text}</div>
              </div>
            ))}
            {isTyping && <div className="flex gap-2 p-3 bg-gray-50 rounded-full w-fit animate-pulse"><div className="w-3 h-3 bg-gray-300 rounded-full" /><div className="w-3 h-3 bg-gray-300 rounded-full" /><div className="w-3 h-3 bg-gray-300 rounded-full" /></div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleChat(userInput); }} className="p-8 border-t-2 border-blue-50 bg-white">
            <div className="relative">
              <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Dis quelque chose..." className="w-full bg-blue-50 border-3 border-blue-100 rounded-3xl px-6 py-5 font-sketch text-2xl focus:outline-none focus:border-blue-400 placeholder:text-blue-200" />
              <button type="submit" disabled={!userInput.trim() || isTyping} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-blue-500 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-95 border-b-4 border-blue-700 transition-all">OK</button>
            </div>
          </form>
        </div>
      </div>

      {gameState?.isGameOver && (
        <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-[200] animate-in fade-in zoom-in duration-500 paper-grid overflow-hidden no-red-line">
           <div className="relative z-10 flex flex-col items-center p-12 bg-white/70 backdrop-blur-xl rounded-[50px] border-4 border-dashed border-gray-200 shadow-2xl max-w-2xl w-full mx-6 text-center">
             <h2 className={`text-6xl md:text-8xl font-sketch leading-none ${gameState.winner === 'player' ? 'text-green-500' : 'text-red-500'} transform -rotate-2 mb-4 animate-bounce`}>
               {gameState.winner === 'player' ? 'VICTOIRE !' : 'DÉFAITE !'}
             </h2>
             <div className="flex justify-center gap-12 font-sketch text-5xl mb-12">
                <div className="text-center bg-blue-50 p-8 rounded-[40px] border-4 border-dashed border-blue-100 flex flex-col min-w-[150px]">
                  <p className="text-gray-400 text-xs uppercase mb-2 font-black">Toi</p>
                  <p className="text-blue-600 font-bold">{gameState.playerScore}</p>
                </div>
                <div className="text-center bg-red-50 p-8 rounded-[40px] border-4 border-dashed border-red-100 flex flex-col min-w-[150px]">
                  <p className="text-gray-400 text-xs uppercase mb-2 font-black">{character.name}</p>
                  <p className="text-red-400 font-bold">{gameState.aiScore}</p>
                </div>
             </div>
             <button onClick={() => { setDifficulty(null); setSelectedTargetScore(null); }} className="px-12 py-6 bg-blue-500 text-white font-sketch text-4xl rounded-[30px] shadow-xl hover:scale-110 border-b-[8px] border-blue-700 active:border-b-[2px] transition-all">RECOMMENCER</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
