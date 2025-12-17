
import React from 'react';
import { Tile } from '../types';

interface DominoTileProps {
  tile?: Tile;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  vertical?: boolean;
  rotation?: number; // degrees
  backside?: boolean;
  themeClass?: string;
}

const Dots = ({ count }: { count: number }) => {
  const dotPositions: Record<number, string[]> = {
    0: [],
    1: ['center'],
    2: ['top-right', 'bottom-left'],
    3: ['top-right', 'center', 'bottom-left'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'center-left', 'center-right', 'bottom-left', 'bottom-right'],
  };

  const positions = dotPositions[count] || [];

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-full h-full p-0.5">
      {positions.includes('top-left') && <div className="dot col-start-1 row-start-1 w-1.5 h-1.5 rounded-full bg-slate-900 mx-auto my-auto" />}
      {positions.includes('top-right') && <div className="dot col-start-3 row-start-1 w-1.5 h-1.5 rounded-full bg-slate-900 mx-auto my-auto" />}
      {positions.includes('center-left') && <div className="dot col-start-1 row-start-2 w-1.5 h-1.5 rounded-full bg-slate-900 mx-auto my-auto" />}
      {positions.includes('center') && <div className="dot col-start-2 row-start-2 w-1.5 h-1.5 rounded-full bg-slate-900 mx-auto my-auto" />}
      {positions.includes('center-right') && <div className="dot col-start-3 row-start-2 w-1.5 h-1.5 rounded-full bg-slate-900 mx-auto my-auto" />}
      {positions.includes('bottom-left') && <div className="dot col-start-1 row-start-3 w-1.5 h-1.5 rounded-full bg-slate-900 mx-auto my-auto" />}
      {positions.includes('bottom-right') && <div className="dot col-start-3 row-start-3 w-1.5 h-1.5 rounded-full bg-slate-900 mx-auto my-auto" />}
    </div>
  );
};

export const DominoTile: React.FC<DominoTileProps> = ({ tile, onClick, disabled, className, vertical, rotation = 0, backside, themeClass }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ transform: `rotate(${rotation}deg)` }}
      className={`
        ${vertical ? 'w-8 h-16 flex-col' : 'w-16 h-8'} 
        bg-white rounded-sm border-[1px] border-slate-400 flex items-center justify-between 
        tile-shadow hover:z-10 transition-all duration-300 tile-base
        ${disabled ? 'opacity-95' : 'cursor-pointer hover:scale-110 active:scale-95'}
        ${backside ? 'bg-slate-50 border-slate-300' : ''}
        ${themeClass || ''}
        ${className}
      `}
    >
      {!backside && tile ? (
        <>
          <div className={`${vertical ? 'h-1/2 w-full' : 'w-1/2 h-full'} flex items-center justify-center`}>
            <Dots count={tile[0]} />
          </div>
          <div className={`${vertical ? 'w-full h-[1px]' : 'h-full w-[1px]'} bg-slate-300`} />
          <div className={`${vertical ? 'h-1/2 w-full' : 'w-1/2 h-full'} flex items-center justify-center`}>
            <Dots count={tile[1]} />
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center opacity-10">
          <div className={`${vertical ? 'w-4 h-0.5' : 'h-4 w-0.5'} bg-slate-400`} />
        </div>
      )}
    </button>
  );
};
