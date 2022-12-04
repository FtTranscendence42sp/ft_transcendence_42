import './Notifications.scss';
import { useContext } from 'react';
import { NotificationChallenge } from './NotificationChallenge/NotificationChallenge';
import { NotificationFriend } from './NotificationFriend/NotificationFriend';
import { NotificationGroupInvite } from './NotificationGroupInvite/NotificationGroupInvite';
import { IntraDataContext } from '../../contexts/IntraDataContext';

export function Notifications() {

  const { intraData } = useContext(IntraDataContext);

  return (
    <div className='notification__body'>
      {intraData.notify.length > 0 ?
        intraData.notify.sort((a, b) => (a.date > b.date) ? -1 : 1)
          .map((obj) =>
            <div key={obj.id}
              className={'notification__body__content'}>
              {(() => {
                if (obj.type === 'friend')
                  return <NotificationFriend notify={obj} />;
                if (obj.type === 'group')
                  return <NotificationGroupInvite notify={obj} />;
                if (obj.type === 'challenge')
                  return <NotificationChallenge notify={obj} />;
              })()}
            </div>
          )
        :
        <p className='notify__content__empty'>empty</p>
      }
    </div>
  );
}
