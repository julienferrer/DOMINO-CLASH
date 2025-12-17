
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
  const [aiAnimatingTile, setAiAnimatingTile] = useState<{tile: Tile, position: 'start' | 'end'} | null>(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      ? `Score: Toi ${gameState.playerScore}, Moi ${gameState.aiScore}. Cible: ${gameState.targetScore}.`
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
    setAiAnimatingTile(null);
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
    setChatMessages([{ role: 'model', text: `Bonjour. Je suis le Tableau Noir, ton narrateur.` }]);
    setTimeout(() => handleChat(`Salut ! Je suis ${aiName}. C'est parti ?`, true), 1000);
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
      return {
        ...prev,
        playerScore: newPlayerScore,
        aiScore: newAiScore,
        winner: finalWinner,
        actions: addAction(prev.actions, "Fin de la manche.")
      };
    });

    const eventMsg = roundWinner === 'player' ? "Gagné pour toi cette fois..." : "Les points sont pour moi !";
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
    setAiAnimatingTile(null);
    setStartingTile(starterInfo.startingTile);
    setGameState(prev => prev ? ({
      ...prev,
      playerHand, aiHand, board: [], boneyard, currentPlayer: starterInfo.player,
      actions: addAction(prev.actions, `Nouveau round : ${starterInfo.message}`)
    }) : null);
  }, [gameState, character]);

  const handleDraw = () => {
    if (!gameState || gameState.currentPlayer !== 'player' || gameState.boneyard.length === 0 || showEndReview || gameState.isGameOver) return;
    if (getValidMoves(gameState.playerHand, gameState.board).length > 0) return;
    setGameState(prev => {
      if (!prev) return null;
      const newBoneyard = [...prev.boneyard];
      const drawnTile = newBoneyard.pop()!;
      return { ...prev, playerHand: [...prev.playerHand, drawnTile], boneyard: newBoneyard, actions: addAction(prev.actions, "Tu pioches un nouveau domino.") };
    });
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
      return { ...prev, playerHand: newHand, board: newBoard, currentPlayer: 'ai', actions: addAction(prev.actions, "Tu joues ton coup.") };
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
          
          const tileToPlay = newHand[idx];
          setAiAnimatingTile({ tile: tileToPlay, position: 'start' });
          
          setTimeout(() => {
            setAiAnimatingTile(null);
            setGameState(st => {
              if (!st) return null;
              const h = [...st.aiHand];
              const i = h.findIndex(t => (t[0] === tileToPlay[0] && t[1] === tileToPlay[1]) || (t[0] === tileToPlay[1] && t[1] === tileToPlay[0]));
              h.splice(i, 1);
              return { ...st, aiHand: h, board: [startingTile], currentPlayer: 'player', actions: addAction(st.actions, `${character?.name} lance la partie.`) };
            });
          }, 600);
          return prev; 
        }

        let currentHand = [...prev.aiHand];
        let currentBoneyard = [...prev.boneyard];
        let drew = false;
        let move = getAIMove(currentHand, prev.board, difficulty!);
        
        while (!move && currentBoneyard.length > 0) {
          const drawn = currentBoneyard.pop()!;
          currentHand.push(drawn);
          drew = true;
          move = getAIMove(currentHand, prev.board, difficulty!);
        }

        if (move) {
          const tileToAnimate = move.tile;
          const posToAnimate = move.position;
          const wasDrew = drew;
          const finalBoneyard = currentBoneyard;
          
          setAiAnimatingTile({ tile: tileToAnimate, position: posToAnimate });

          setTimeout(() => {
            setAiAnimatingTile(null);
            setGameState(st => {
              if (!st) return null;
              const newBoard = [...st.board];
              const newHand = [...st.aiHand];
              
              let effectiveHand = drew ? currentHand : newHand;
              const effectiveIdx = effectiveHand.findIndex(t => t[0] === tileToAnimate[0] && t[1] === tileToAnimate[1]);
              effectiveHand.splice(effectiveIdx, 1);

              let placedTile = [...tileToAnimate] as Tile;
              if (posToAnimate === 'start') {
                if (newBoard.length > 0 && placedTile[1] !== newBoard[0][0]) placedTile = [placedTile[1], placedTile[0]];
                newBoard.unshift(placedTile);
              } else {
                if (newBoard.length > 0 && placedTile[0] !== newBoard[newBoard.length - 1][1]) placedTile = [placedTile[1], placedTile[0]];
                newBoard.push(placedTile);
              }

              const message = wasDrew ? `${character?.name} a pioché puis joué.` : `${character?.name} a joué son coup.`;
              if (effectiveHand.length === 0) {
                setTimeout(() => endRound('ai'), 300);
                return { ...st, aiHand: effectiveHand, board: newBoard, boneyard: finalBoneyard, currentPlayer: 'player', actions: addAction(st.actions, `${character?.name} finit sa main !`) };
              }
              return { ...st, aiHand: effectiveHand, board: newBoard, boneyard: finalBoneyard, currentPlayer: 'player', actions: addAction(st.actions, message) };
            });
          }, 600);
          return prev;
        } else {
          const playerMoves = getValidMoves(prev.playerHand, prev.board);
          if (playerMoves.length === 0) {
            setTimeout(() => endRound('blocked'), 100);
            return { ...prev, aiHand: currentHand, boneyard: currentBoneyard, actions: addAction(prev.actions, "Le jeu est bloqué !") };
          }
          return { ...prev, aiHand: currentHand, boneyard: currentBoneyard, currentPlayer: 'player', actions: addAction(prev.actions, `${character?.name} a pioché sans pouvoir jouer.`) };
        }
      });
    }, 1200);
  }, [gameState?.currentPlayer, difficulty, character, startingTile, showEndReview, gameState?.isGameOver]);

  useEffect(() => {
    if (gameState?.currentPlayer === 'ai' && !gameState.isGameOver && !showEndReview) executeAIMove();
  }, [gameState?.currentPlayer, executeAIMove, gameState?.isGameOver, showEndReview]);

  const boardScale = useMemo(() => {
    if (!gameState || gameState.board.length === 0) return 1;
    const tileWidth = 66; 
    const totalWidth = gameState.board.length * tileWidth;
    // Sur mobile, on utilise toute la largeur. Sur PC, on soustrait la largeur du chat (450px environ).
    const chatWidth = window.innerWidth >= 768 ? 450 : 0;
    const availableWidth = (window.innerWidth - chatWidth) * 0.95; 
    if (totalWidth < availableWidth) return 1;
    return Math.max(0.1, availableWidth / totalWidth);
  }, [gameState?.board.length]);

  if (!difficulty || !selectedTargetScore) {
    return (
      <div className="min-h-screen paper-grid flex flex-col items-center justify-start md:justify-center p-6 md:p-12 overflow-y-auto relative scrollbar-hide">
        <div className="z-10 text-center flex flex-col items-center w-full max-w-6xl py-8">
          <h1 className="text-5xl md:text-8xl font-sketch text-blue-600 mb-2 transform -rotate-2">DOMINO CLASH</h1>
          <p className="text-lg md:text-2xl font-sketch text-gray-400 mb-12 italic">"Le duel sur papier blanc."</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 w-full mb-12">
            {(Object.values(CHARACTERS) as Character[]).map((char) => (
              <div 
                key={char.difficulty} 
                className="group bg-white border-4 border-dashed border-gray-100 rounded-3xl p-6 flex flex-col items-center transition-all duration-300 hover:rotate-1 cursor-pointer shadow-lg hover:shadow-2xl active:scale-95" 
                onClick={() => setDifficulty(char.difficulty)}
              >
                <img src={char.avatar} alt={char.name} className="w-28 h-28 md:w-40 md:h-40 rounded-full mb-4 object-cover border-4 border-white shadow-md transform group-hover:scale-110 transition-transform" />
                <h2 className={`text-3xl md:text-4xl font-sketch ${char.nameColor}`}>{char.name}</h2>
                <p className="font-sketch text-gray-400 mt-2 text-lg">{char.description}</p>
              </div>
            ))}
          </div>
          {difficulty && (
            <div className="fixed inset-0 bg-white/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <div className="bg-white p-8 md:p-12 border-4 border-dashed border-blue-200 rounded-3xl flex flex-col items-center w-full max-w-lg shadow-2xl animate-in zoom-in duration-300">
                <h2 className="text-3xl md:text-4xl font-sketch mb-8 text-blue-500 text-center">Objectif du match ?</h2>
                <div className="flex gap-4 md:gap-6">
                  {[25, 50, 100].map(val => (
                    <button 
                      key={val} 
                      onClick={() => startNewGame(difficulty, val)} 
                      className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-blue-100 text-2xl md:text-4xl font-sketch text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center"
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <button onClick={() => setDifficulty(null)} className="mt-8 text-gray-400 font-sketch text-xl underline hover:text-gray-600 transition-colors">Retour au choix</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen paper-grid flex flex-col overflow-hidden relative">
      <div className="glass-hud p-3 md:p-4 flex justify-between items-center z-[60] shadow-sm border-b border-gray-100">
        <button onClick={() => { setDifficulty(null); setSelectedTargetScore(null); }} className="font-sketch text-lg md:text-xl text-red-500 hover:text-red-400 transition-colors">← QUITTER</button>
        <div className="flex gap-4 md:gap-8 font-sketch text-lg md:text-2xl text-gray-800">
          <p className="whitespace-nowrap">Toi: <span className="font-bold text-blue-600">{gameState?.playerScore}</span></p>
          <p className="whitespace-nowrap"><span className={character.nameColor}>{character.name}</span>: <span className="font-bold text-orange-500">{gameState?.aiScore}</span></p>
          <p className="text-gray-300 hidden md:block">/ {gameState?.targetScore}</p>
        </div>
        {/* Bouton Chat Mobile */}
        <button 
          onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
          className="md:hidden w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
        >
          {isMobileChatOpen ? '✕' : '💬'}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="flex-1 relative flex flex-col overflow-hidden">
          {/* Main de l'IA */}
          <div className="pt-2 md:pt-4 pb-1 md:pb-2 flex justify-center gap-1">
            {gameState?.aiHand.map((tile, i) => (
              <DominoTile 
                key={`ai-${i}`} 
                tile={tile} 
                vertical 
                backside={!showEndReview} 
                className={`scale-[0.6] md:scale-75 origin-top border-blue-100 opacity-100 shadow-sm transition-all duration-500`} 
                themeClass={character.tileStyle} 
              />
            ))}
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
            <div 
              id="board-container" 
              className="flex flex-nowrap items-center justify-center gap-0 min-w-max relative"
              style={{ transform: `scale(${boardScale})` }}
            >
              {aiAnimatingTile && (
                <div className={`absolute ${aiAnimatingTile.position === 'start' ? '-left-20' : '-right-20'} top-0 ai-play-anim`}>
                  <DominoTile 
                    tile={aiAnimatingTile.tile} 
                    vertical={aiAnimatingTile.tile[0] === aiAnimatingTile.tile[1]} 
                    themeClass={character.tileStyle}
                    className="border-2 border-blue-400 shadow-xl"
                  />
                </div>
              )}

              {gameState?.board.map((tile, i) => (
                <DominoTile 
                  key={`${i}-${tile[0]}-${tile[1]}`} 
                  tile={tile} 
                  disabled 
                  vertical={tile[0] === tile[1]} 
                  className="shadow-sm border-2 border-gray-300 tile-placed-animation" 
                  themeClass={character.tileStyle} 
                />
              ))}
            </div>
          </div>

          {pendingPlacement && (
            <div className="absolute inset-0 z-[100] bg-white/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white p-6 md:p-10 rounded-[30px] md:rounded-[40px] border-4 border-dashed border-blue-200 shadow-2xl flex flex-col items-center w-full max-w-sm">
                <p className="font-sketch text-2xl md:text-3xl mb-8 text-blue-600">Où poser ton domino ?</p>
                <div className="flex gap-4 md:gap-8 w-full">
                  <button onClick={() => applyPlacement(pendingPlacement.tile, pendingPlacement.index, 'start')} className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-sketch text-xl md:text-2xl border-b-4 md:border-b-8 border-blue-700 active:translate-y-1 transition-all">GAUCHE</button>
                  <button onClick={() => applyPlacement(pendingPlacement.tile, pendingPlacement.index, 'end')} className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-sketch text-xl md:text-2xl border-b-4 md:border-b-8 border-blue-700 active:translate-y-1 transition-all">DROITE</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/40 p-4 md:p-6 border-t border-gray-100 z-50 backdrop-blur-md">
            <div className="flex justify-between items-center mb-4 md:mb-6 max-w-6xl mx-auto gap-4">
              <div className="flex gap-2 md:gap-4 items-center">
                 <button onClick={handleDraw} disabled={!gameState || (getValidMoves(gameState.playerHand, gameState.board).length > 0) || gameState.boneyard.length === 0 || showEndReview} className={`w-14 h-14 md:w-20 md:h-20 bg-white rounded-xl md:rounded-2xl border-2 border-blue-200 flex flex-col items-center justify-center transition-all shadow-sm ${gameState && getValidMoves(gameState.playerHand, gameState.board).length === 0 && gameState.boneyard.length > 0 && !showEndReview ? 'pulse-draw' : 'opacity-20'}`}>
                   <span className="text-xl md:text-2xl font-bold text-blue-600">{gameState?.boneyard.length}</span>
                   <span className="font-sketch text-blue-300 text-[8px] md:text-xs uppercase tracking-widest">Pioche</span>
                 </button>
                 {showEndReview && !gameState?.isGameOver && (
                    isMatchFinished ? (
                      <button onClick={triggerGameOver} className="px-6 py-3 md:px-10 md:py-5 bg-red-500 text-white rounded-xl md:rounded-2xl font-sketch text-xl md:text-3xl border-b-4 md:border-b-8 border-red-700 animate-pulse">TERMINER</button>
                    ) : (
                      <button onClick={handleNextRound} className="px-6 py-3 md:px-10 md:py-5 bg-green-500 text-white rounded-xl md:rounded-2xl font-sketch text-xl md:text-3xl border-b-4 md:border-b-8 border-green-700">SUIVANT</button>
                    )
                 )}
              </div>
              
              <div className="flex-1 text-right flex flex-col items-end min-h-[80px] md:min-h-[110px] bg-[#1a1a1a] p-2 md:p-4 rounded-xl border-2 md:border-4 border-gray-400 shadow-inner relative max-w-[200px] md:max-w-[300px]">
                 <span className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 md:mb-2">Le Narrateur</span>
                 <div className="flex flex-col gap-0.5 md:gap-1 items-end w-full overflow-hidden">
                    {gameState?.actions.map((action, idx) => (
                      <p key={idx} className={`font-sketch text-sm md:text-xl italic transition-all duration-500 truncate w-full ${idx === gameState.actions.length - 1 ? 'text-white scale-105 opacity-100' : 'text-gray-500 opacity-60 scale-100'}`}>
                        {action}
                      </p>
                    ))}
                 </div>
              </div>
            </div>
            
            <div className="flex justify-start md:justify-center gap-2 overflow-x-auto pt-4 md:pt-6 pb-2 md:pb-6 scrollbar-hide mask-hand">
              {gameState?.playerHand.map((tile, i) => {
                let playable = getPossiblePlacements(tile, gameState.board).length > 0;
                if (gameState.board.length === 0 && startingTile) playable = (tile[0] === startingTile[0] && tile[1] === startingTile[1]);
                const isTurn = gameState.currentPlayer === 'player' && !showEndReview && !gameState.isGameOver;
                return (
                  <DominoTile 
                    key={i} 
                    tile={tile} 
                    vertical 
                    onClick={() => playTile(i)} 
                    disabled={!isTurn || !playable} 
                    className={`${!playable ? 'grayscale opacity-10' : 'tile-dance mx-1'} flex-shrink-0 scale-90 md:scale-100`} 
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat - Sidebar sur PC, Overlay sur Mobile */}
        <div className={`
          ${isMobileChatOpen ? 'flex' : 'hidden md:flex'}
          fixed md:relative inset-0 md:inset-auto w-full md:w-96 glass-chat flex flex-col z-[100] md:z-50 shadow-xl
        `}>
          <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src={character.avatar} alt={character.name} className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover border-2 border-white transform -rotate-3 shadow-sm" />
              <p className={`text-xl md:text-2xl font-sketch ${character.nameColor}`}>{character.name}</p>
            </div>
            <button onClick={() => setIsMobileChatOpen(false)} className="md:hidden p-2 text-gray-400">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-hide">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] px-4 py-2 md:py-3 font-sketch text-lg md:text-xl border border-gray-100 shadow-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-2xl rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-2xl rounded-tl-none transform rotate-1'}`}>{msg.text}</div>
              </div>
            ))}
            {isTyping && <div className="animate-pulse font-sketch text-blue-400">Écrit...</div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleChat(userInput); }} className="p-4 md:p-6 border-t border-gray-100 bg-white">
            <div className="relative">
              <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Un message ?" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 md:py-3 font-sketch text-lg md:text-xl focus:outline-none focus:border-blue-300 placeholder:text-gray-300" />
              <button type="submit" disabled={!userInput.trim() || isTyping} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-500 text-white rounded-xl font-sketch text-lg hover:bg-blue-600 transition-colors">OK</button>
            </div>
          </form>
        </div>
      </div>

      {gameState?.isGameOver && (
        <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-[200] animate-in fade-in duration-500 paper-grid p-4">
             <div className="bg-white p-8 md:p-16 rounded-[40px] md:rounded-[50px] border-4 border-dashed border-blue-200 shadow-2xl text-center w-full max-w-lg">
               <h2 className={`text-5xl md:text-8xl font-sketch mb-4 md:mb-8 ${gameState.winner === 'player' ? 'text-green-500' : 'text-red-500'} animate-bounce`}>
                 {gameState.winner === 'player' ? 'VICTOIRE !' : 'DÉFAITE !'}
               </h2>
               <p className="font-sketch text-2xl md:text-4xl mb-8 md:mb-12 text-gray-600">{gameState.playerScore} - {gameState.aiScore}</p>
               <button onClick={() => { setDifficulty(null); setSelectedTargetScore(null); }} className="w-full md:w-auto px-8 py-4 md:px-12 md:py-6 bg-blue-500 text-white font-sketch text-2xl md:text-4xl rounded-2xl md:rounded-3xl shadow-xl border-b-4 md:border-b-8 border-blue-700 hover:bg-blue-400 transition-all">RECOMMENCER</button>
             </div>
        </div>
      )}
    </div>
  );
};

export default App;
