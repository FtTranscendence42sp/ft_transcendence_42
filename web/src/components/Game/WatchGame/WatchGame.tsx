import './WatchGame.scss';
import { useSnapshot } from 'valtio';
import { useEffect, useState } from 'react';
import { actionsGame, Game, stateGame } from '../../../adapters/game/gameState';
import { getNameLimited } from '../../../others/utils/utils';

export function WatchGame() {
  const currentState = useSnapshot(stateGame);
  const [gameList, setGameList] = useState<Game[]>([]);

  const handleWatchLiveGame = (game: Game) => {
    if (game.hasEnded) {
      return;
    }
    actionsGame.updateGame(game);
    currentState.socket?.emit('watch-game', game.room);
  };

  function getList() {
    currentState.socket?.emit('get-game-list');
    currentState.socket?.on('get-game-list', (games: Game[]) => {
      if (games[0]) {
        setGameList(games);
      } else {
        setGameList([]);
      }
    });
  }

  useEffect(() => {
    getList();
  }, []);

  return (
    <div className='gameMenu__watchGame'>
      <h2>Live Games</h2>
      <ul className='gameMenu__watchGame__list'>
        {
          gameList?.length > 0 ?
            gameList?.map(game => {
              return (
                <li onClick={() => { handleWatchLiveGame(game); }} key={game.room}>
                  {getNameLimited(game.player1Name)} vs {getNameLimited(game.player2Name)}
                </li>
              );
            }) : <p>No game Available</p>}
      </ul>
    </div>
  );
}
