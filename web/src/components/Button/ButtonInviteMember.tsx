import './Button.scss';
import './ButtonInviteMember.scss';
import { PaperPlaneRight, UserPlus } from 'phosphor-react';
import { GlobalContext } from '../../contexts/GlobalContext';
import { actionsStatus } from '../../adapters/status/statusState';
import { useContext, useState } from 'react';
import { Modal } from '../Modal/Modal';
import ReactTooltip from 'react-tooltip';


interface ButtonInviteMemberProps {
  id: string;
}

export function ButtonInviteMember({ id }: ButtonInviteMemberProps) {
  const { api, config } = useContext(GlobalContext);
  const [modalInviteMember, setModalInviteMember] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [placeHolder, setPlaceHolder] = useState('');

  function handleKeyEnter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendGroupInvite();
  }

  async function sendGroupInvite() {
    try {
      if (inviteName.trim()) {
        await api.patch('/chat/sendGroupInvite', { name: inviteName, groupId: id }, config);
        actionsStatus.newNotify(inviteName);
        setInviteName('');
        setModalInviteMember(false);
      }
    } catch (err: any) {
      setInviteName('');
      setPlaceHolder(err.response.data.message);
    }
  }

  return (
    <>
      <button
        id='inviteMember_button'
        className='button__icon'
        onClick={() => setModalInviteMember(true)}
        data-tip={'Invite User'}
      >
        <UserPlus size={32} />
        <ReactTooltip delayShow={50} />
      </button>
      {modalInviteMember &&
        <Modal id='button__invite__member'
          onClose={() => setModalInviteMember(false)}
        >
          <form className='button__invite__member__form' onSubmit={handleKeyEnter}>
            <div className='button__invite__member__div'>
              <h3>Insert a nick</h3>
              <input
                className='button__invite__member__input'
                maxLength={15}
                value={inviteName}
                placeholder={placeHolder}
                style={{ border: placeHolder !== '' ? '3px solid red' : 'none' }}
                onChange={(e) => {
                  setInviteName(e.target.value);
                  setPlaceHolder('');
                }}
                ref={e => e?.focus()}
              />
            </div>
            <button className='button__invite__member__send' type='submit'>
              <PaperPlaneRight size={30} />
            </button>
          </form>
        </Modal>
      }
    </>
  );
}
