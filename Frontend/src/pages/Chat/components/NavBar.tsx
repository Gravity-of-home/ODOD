import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jwtAxios from '@/utils/JWTUtil';
import { toast } from 'react-toastify';
import imageCompression from 'browser-image-compression';

interface IUser {
  id: number;
  role: string;
  nickname: string;
  gender: string;
  ageGroup: string;
  profileImage: string;
  isPaid: boolean;
}

interface INavBarProps {
  title: string;
  departuresName: string;
  arrivalsName: string;
  departuresDate: string;
  state: string;
  me: IUser;
  fetchData: () => void;
}

const NavBar: React.FC<INavBarProps> = ({
  title,
  departuresName,
  arrivalsName,
  departuresDate,
  state,
  me,
  fetchData,
}) => {
  const { partyId } = useParams();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const toggleModal = () => setIsModalOpen(!isModalOpen);

  const [amount, setAmount] = useState<number>(0);
  const [imageFile, setImageFile] = useState<File | undefined>(undefined);

  async function handleImageUpload(event: File) {
    const imageFile = event;
    console.log('originalFile instanceof Blob', imageFile instanceof Blob); // true
    console.log(`originalFile size ${imageFile.size / 1024 / 1024} MB`);

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    try {
      const compressedFile = await imageCompression(imageFile, options);
      console.log('compressedFile instanceof Blob', compressedFile instanceof Blob); // true
      console.log(`compressedFile size ${compressedFile.size / 1024 / 1024} MB`); // smaller than maxSizeMB
      return compressedFile;
    } catch (error) {
      console.log(error);
    }
  }
  const handleAmountChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(event.target.value));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (
      event.target.files &&
      event.target.files[0] &&
      event.target.files[0].type.startsWith('image/')
    ) {
      try {
        const compressedImage = await handleImageUpload(event.target.files[0]); // Wait for the compression to complete
        setImageFile(compressedImage); // Set the compressed image file
      } catch (error) {
        console.error('Error compressing the image:', error);
        alert('Failed to compress image.');
        setImageFile(undefined);
      }
    } else {
      alert('이미지 파일만 업로드 가능합니다.');
      setImageFile(undefined);
    }
  };
  let stateComponent;
  if (state === 'GATHERING') {
    stateComponent = <div className='badge badge-primary badge-outline'>모집중</div>;
  } else if (state === 'SETTLING') {
    stateComponent = <div className='badge badge-primary badge-outline'>정산중</div>;
  } else if (state === 'COMPLETED') {
    stateComponent = <div className='badge badge-error badge-outline'>모집마감</div>;
  } else if (state === 'SETTLED') {
    stateComponent = <div className='badge badge-error badge-outline'>정산완료</div>;
  }
  function goDetail() {
    navigate(`/chat/detail/${partyId}`);
  }
  function goBack() {
    navigate(`/party/${partyId}`);
  }

  const requestCharge = () => {
    if (!imageFile) {
      alert('영수증을 첨부해주세요.');
      return;
    }

    const formData = new FormData();
    formData.append('newImage', imageFile);
    formData.append('cost', amount.toString());

    jwtAxios
      .post(`/api/parties/${partyId}/arriving`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      .then(res => {
        console.log(res);
        if (res.data.status) {
          toast.success(res.data.message, {
            pauseOnFocusLoss: false,
            hideProgressBar: true,
            closeOnClick: true,
          });
          toggleModal();
        }
      })
      .catch(err => {
        toast.error(err.response.data.reason);
        console.error(err);
      });
    fetchData();
  };

  const chargeFee = () => {
    jwtAxios
      .post(`/api/parties/${partyId}/settlement`)
      .then(res => {
        console.log(res);
        if (res.data.status === 204) {
          toast.success('정산을 완료했습니다');
        }
      })
      .catch(err => {
        toast.error(err.response.data.message);
        console.error(err);
      });
    fetchData();
  };

  return (
    <div className='fixed top-0 bg-white w-screen z-10'>
      <div className='flex items-center justify-between'>
        <button onClick={goBack} className='btn btn-ghost btn-circle text-3xl'>
          {'<'}
        </button>
        <p className='font-bold text-2xl flex-grow text-center'>{title}</p>
        <button onClick={goDetail} className='btn btn-square btn-ghost'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            className='inline-block w-5 h-5 stroke-current'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              d='M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z'></path>
          </svg>
        </button>
      </div>
      <div className='divider m-0'></div>
      <div className='flex mt-2'>
        <div className='px-4'>{stateComponent}</div>
        <div>
          <p>
            {departuresName} {'>'} {arrivalsName}
          </p>
          <p>{departuresDate}</p>
        </div>
      </div>
      <div className='mt-1'>
        {state === 'COMPLETED' && (
          <div onClick={toggleModal} className='btn btn-block btn-primary'>
            <p className='font-bold text-white'>1/N 정산요청하기</p>
          </div>
        )}
        {state === 'SETTLING' && me.isPaid === false && (
          <div onClick={chargeFee} className='btn btn-block'>
            <p>1/N 정산하기</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className='modal modal-open'>
          <div className='modal-box relative'>
            <button className='btn btn-sm btn-circle absolute right-2 top-2' onClick={toggleModal}>
              ✕
            </button>
            <h3 className='font-bold text-lg mb-4'>정산 금액 입력</h3>
            <div className='form-control'>
              <label className='label'>
                <span className='label-text'>금액</span>
              </label>
              <input
                type='number'
                value={amount}
                onChange={handleAmountChange}
                placeholder='금액 입력'
                className='input input-bordered input-primary w-full max-w-xs'
              />
            </div>
            <div className='form-control mt-4'>
              <label className='label'>
                <span className='label-text'>영수증 이미지</span>
              </label>
              <input
                type='file'
                accept='image/*'
                onChange={handleFileChange}
                className='file-input file-input-bordered w-full max-w-xs'
              />
            </div>
            <div className='modal-action'>
              <button onClick={requestCharge} className='btn btn-block btn-primary'>
                요청하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavBar;
