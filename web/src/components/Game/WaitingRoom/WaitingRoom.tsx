/* eslint-disable indent */
import { useEffect, useState } from 'react';
import { stateGame } from '../../../adapters/game/gameState';
import { Modal } from '../../Modal/Modal';
import { Loader } from '../Loader/Loader';
import './WaitingRoom.scss';

export function WaitingRoom() {

  const [modalReject, setModalReject] = useState<boolean>(false);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    stateGame.socket?.on('reject-challenge', () => {
      setModalReject(true);
    });
  }, []);

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'q':
      case 'Q':
      case 'Escape':
        window.location.reload();
        break;
    }
  }

  return (
    <div className='waiting-room'>
      <h1>Waiting for another player!</h1>
      <Loader />
      <p>Press Q to Leave!</p>
      {
        modalReject &&
        <Modal onClose={() => window.location.reload()} id='waiting-room__modal'>
          Your challenge was rejected!
        </Modal>
      }
    </div>
  );
}
