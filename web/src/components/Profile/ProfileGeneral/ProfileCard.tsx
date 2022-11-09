
import './ProfileCard.scss';
import UserImage from './UserImage';
import { IntraData } from '../../../Interfaces/interfaces';
import { NotePencil } from 'phosphor-react';
import { TFAButton } from '../../TFA/TFAButton/TFAButton';
import { ChangeNick } from '../../ChangeNick/ChangeNick';
import { getStoredData } from '../../../utils/utils';
import { Dispatch, SetStateAction, useInsertionEffect, useState } from 'react';

interface ProfileCardProps {
  email: string;
  image_url: string;
  login: string;
  full_name: string;
  setIntraData: Dispatch<SetStateAction<IntraData>>;
}

export default function ProfileCard({
  email,
  image_url,
  login,
  full_name,
  setIntraData,
}: ProfileCardProps) {
  const [isModalChangeNickVisible, setIsModalChangeNickVisible] =
    useState(false);
  useInsertionEffect(() => {
    window.localStorage.removeItem('userData');
    getStoredData(setIntraData);
  }, []);

  return (
    <div className="profileCard">
      <UserImage
        image_url={image_url}
        login={login}
        setIntraData={setIntraData}
      ></UserImage>
      <strong className="profileCard__infos">{full_name}</strong>
      <strong className="profileCard__infos">{email}</strong>
      <div className="profileCard__infos__nick">
        <strong>{login}</strong>
        <div className="profileCard__infos__button">
          <NotePencil
            size={32}
            onClick={() => setIsModalChangeNickVisible(true)}
          />
        </div>
        {isModalChangeNickVisible ? (
          <ChangeNick
            setIntraData={setIntraData}
            setIsModalChangeNickVisible={setIsModalChangeNickVisible}
          />
        ) : null}
      </div>
      <TFAButton />
    </div >
  );
}