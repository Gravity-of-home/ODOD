import { useState, useEffect, useRef, ChangeEvent } from 'react';
import latLngAddStore from '@/stores/useLatLngAddStore';
import mapStore from '@/stores/useMapStore';
import watchPositionHook from '@/hooks/useRefreshLocation';
import DarkModeStyle from './DarkModeStyle';
import RetroStyle from './RetroStyle';
import StandardStyle from './StandardStyle';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '@/components/BottomSheet/BottomSheet';
import autoMatchStore from '@/stores/useAutoPartyStore';
import CURLOCMARKER from '@/assets/image/icons/CURLOCMARKER.png';
import SvgCurLoc from '@/assets/svg/SvgCurLoc.tsx';
import { toast } from 'react-toastify';
import jwtAxios from '@/utils/JWTUtil';
import SvgChat from '@/assets/svg/SvgChat.tsx';
import SvgProfile from '@/assets/svg/SvgProfile';
import AutoPartyMap from './AutoPartyMap';
import SvgDepartureMarker from '@/assets/svg/SvgDepartureMarker';
import SvgArrivalMarker from '@/assets/svg/SvgArrivalMarker';
import Front from '@/assets/image/icons/Front.png';
import userStore from '@/stores/useUserStore';
import { getCookie } from '@/utils/CookieUtil';
import axios from 'axios';
import { ViteConfig } from '@/apis/ViteConfig';
import { categoryIcons } from '@/constants/constants';
import { useMatchSocket } from '@/context/matchSocketProvider';
import { IParty, IPlaceInfo } from '@/types/Party';
import {
  categoryList,
  categoryColorList,
  genderRestrictionList,
  partyStateList,
  stateColorList,
  calcDate,
  formatDate,
} from '@/components/BottomSheet/BottomSheetContent';
import SvgRouteIcon from '@/assets/svg/SvgRouteIcon';
import SvgTimerIcon from '@/assets/svg/SvgTimerIcon';
import SvgParticipantsIcon from '@/assets/svg/SvgParticipantsIcon';
import PartyItemMap from './PartyItemMap';
import SvgSearch from '@/assets/svg/SvgSearch';
import SvgGoTo from '@/assets/svg/SvgGoTo';
import SearchDataItem from '@/pages/Home/components/SearchDataItem.tsx';

interface IAutoMatchData {
  depName?: string;
  depLon?: number;
  depLat?: number;
  arrName?: string;
  arrLon?: number;
  arrLat?: number;
}

interface ISuccessData {
  memberID1: number;
  memberID2: number;
  partyId: number;
  request: IAutoMatchData;
  type: string;
}

const MapRef = () => {
  watchPositionHook();
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const { currentAdd, currentLat, currentLng } = latLngAddStore();
  const { setGoogleMap, setLatitude, setLongitude } = mapStore();
  const { isAutoMatch, depName, depLoc, arrName, arrLoc, setDep, setArr, setIsAutoMatch } =
    autoMatchStore();
  const [curLocAdd, setCurLocAdd] = useState<string>('내 위치');
  const autoMatchModalRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLng>(
    new google.maps.LatLng({ lat: currentLat, lng: currentLng }),
  );
  const [curMarker, setCurMarker] = useState<google.maps.Marker | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const { matchClient, isMatchConnected, disconnectMatch } = useMatchSocket();
  const [partyData, setPartyData] = useState<IParty[]>([]);
  const [detailParty, setDetailParty] = useState<IParty | null>(null);
  const partyDetailModalRef = useRef<HTMLDialogElement>(null);
  const [progress, setProgress] = useState(100);
  const { id } = userStore();
  const [reqAutoMatchData, setReqAutoMatchData] = useState<IAutoMatchData>({
    depName: '',
    depLon: 0,
    depLat: 0,
    arrName: '',
    arrLon: 0,
    arrLat: 0,
  });
  const [autoMatchData, setAutoMatchData] = useState<ISuccessData>({
    memberID1: 0,
    memberID2: 0,
    partyId: 0,
    request: {
      depName: '',
      depLon: 0,
      depLat: 0,
      arrName: '',
      arrLon: 0,
      arrLat: 0,
    },
    type: '',
  });
  const [isSuccess, setIsSuccess] = useState(false);

  const goCreateParty = () => {
    nav('/party');
  };

  const openAutoMatchModal = () => {
    if (autoMatchModalRef.current) {
      setIsOpen(true);
      autoMatchModalRef.current.showModal();
    }
  };

  const closeAutoMatchModal = () => {
    if (autoMatchModalRef.current) {
      setIsOpen(false);
      autoMatchModalRef.current.close();
    }
  };

  const reqAutoMatch = () => {
    let newDepName = depName;

    if (arrName === '도착지를 설정해 주세요.') return toast.error('도착지를 설정해 주세요.');

    if (depName === '내 위치') {
      getAddByLatLng(depLoc!.latitude, depLoc!.longitude).then(res => {
        newDepName = res;
      });
    }
    setIsLoading(true);
    setProgress(100);
    const data = {
      depName: newDepName,
      depLon: depLoc!.longitude,
      depLat: depLoc!.latitude,
      arrName: arrName,
      arrLon: arrLoc!.longitude,
      arrLat: arrLoc!.latitude,
    };
    setReqAutoMatchData(data);
    try {
      if (matchClient && matchClient.connected) {
        // console.log(data);
        matchClient.publish({
          destination: `/pub/match/${id}`,
          body: JSON.stringify(data),
          headers: {
            token: `${getCookie('Authorization')}`,
          },
        });
      }
    } catch (error) {}
  };

  const reqCancelMatch = async () => {
    if (timeoutId.current !== null) {
      console.log('30초 대기 TIMEOUT 삭제');
      clearTimeout(timeoutId.current as NodeJS.Timeout);
    }
    if (intervalId.current !== null) {
      console.log('30초 대기 INTERVAL 삭제');
      clearInterval(intervalId.current as NodeJS.Timeout);
    }
    try {
      const response = await axios.delete(`${ViteConfig.VITE_BASE_URL}/api/matches/${id}`, {
        headers: {
          AUTHORIZATION: `Bearer ${getCookie('Authorization')}`,
        },
      });

      // console.log('Delete request successful:', response);
      setIsLoading(false);
      setIsAutoMatch(false);
      setDep?.('내 위치', { latitude: currentLat, longitude: currentLng });
      setArr?.('도착지를 설정해 주세요.', { latitude: 0, longitude: 0 });
      toast.error('매칭이 취소되었습니다.', { autoClose: 3000 });
    } catch (err) {
      // console.error('Match ID DELETE Request failed:', err);
    }
    closeAutoMatchModal();
  };

  const successMatch = () => {
    setIsSuccess(false);
    setIsLoading(false);
    setIsAutoMatch(false);
    setDep?.('내 위치', { latitude: currentLat, longitude: currentLng });
    setArr?.('도착지를 설정해 주세요.', { latitude: 0, longitude: 0 });
    nav(`/party/${autoMatchData.partyId}`);
  };

  const goSetDeparture = () => {
    nav('/party/departure', { state: { from: '/home' } });
    setIsAutoMatch(true);
  };

  const goSetArrival = () => {
    nav('/party/arrival', { state: { from: '/home' } });
    setIsAutoMatch(true);
  };

  const successReq = () => {
    console.log('현위치 조회에 성공했습니다.');
  };
  const failReq = () => {
    return toast.error('현위치 조회에 실패했습니다.');
  };

  const goCurrentLoc = () => {
    navigator.geolocation.getCurrentPosition(
      getPosSuccess,
      () => toast.error('위치 정보를 가져오는데 실패했습니다.'),
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000,
      },
    );
  };

  const getPosSuccess = (pos: GeolocationPosition) => {
    const currentPos = new google.maps.LatLng({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    });
    getAddByLatLng(pos.coords.latitude, pos.coords.longitude).then(res => {
      setDep?.(res, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    });

    if (map && curMarker) {
      map!.setZoom(16);
      map!.panTo(currentPos as google.maps.LatLng);
      curMarker!.setPosition(currentPos);
    }
  };

  const getAddByLatLng = async (lat: number, lng: number) => {
    try {
      const { data } = await jwtAxios.get(`/api/places/place?longitude=${lng}&latitude=${lat}`);

      setCurLocAdd(
        data.data.roadNameAddress === null
          ? data.data.jibunAddress === null
            ? '장소 정보 미제공'
            : data.data.jibunAddress
          : data.data.roadNameAddress,
      );
      successReq();
      return data.data.roadNameAddress === null
        ? data.data.jibunAddress === null
          ? '장소 정보 미제공'
          : data.data.jibunAddress
        : data.data.roadNameAddress;
    } catch (error) {
      failReq();
    }
  };

  useEffect(() => {
    if (ref.current && !map) {
      if (depName === '') {
        setDep?.('내 위치', { latitude: currentLat, longitude: currentLng });
      }
      const initialMap = new google.maps.Map(ref.current, {
        center: mapCenter,
        disableDefaultUI: true,
        clickableIcons: false,
        styles: StandardStyle,
        zoom: 16,
        minZoom: 10,
        maxZoom: 18,
        gestureHandling: 'greedy',
        restriction: {
          latLngBounds: {
            north: 43,
            south: 33,
            west: 124,
            east: 132,
          },
          strictBounds: true,
        },
      });
      setMap(initialMap);
      setGoogleMap?.(initialMap);

      const markerInstance = new window.google.maps.Marker({
        position: initialMap.getCenter(),
        map: initialMap,
        icon: {
          url: CURLOCMARKER,
          scaledSize: new window.google.maps.Size(50, 50),
        },
        draggable: false,
        zIndex: 10,
      });

      setCurMarker(markerInstance);

      google.maps.event.addListener(initialMap, 'dragend', () => {
        const newCenter = initialMap.getCenter();
        if (newCenter) {
          setMapCenter(newCenter);
          getAddByLatLng(newCenter.lat(), newCenter.lng());
        }
      });
    }
  }, [ref, mapCenter, map]);

  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (matchClient && matchClient.connected) {
      const subscription = matchClient.subscribe(
        `/sub/matchResult/${id}`,
        message => {
          // console.log(JSON.parse(message.body));
          const newMessage = JSON.parse(message.body);

          // console.log('AUTO MATCH MSG TYPE.', newMessage.type);
          // console.log('AUTO MATCH MSG BODY.', newMessage);

          switch (newMessage.type) {
            case 'MATCH_SUCCESS':
              if (timeoutId.current !== null) {
                // console.log('30초 대기 TIMEOUT 삭제');
                clearTimeout(timeoutId.current as NodeJS.Timeout);
              }
              if (intervalId.current !== null) {
                // console.log('30초 대기 INTERVAL 삭제');
                clearInterval(intervalId.current as NodeJS.Timeout);
              }
              setDep?.(newMessage.request.depName, {
                latitude: newMessage.request.depLat,
                longitude: newMessage.request.depLon,
              });
              setArr?.(newMessage.request.arrName, {
                latitude: newMessage.request.arrLat,
                longitude: newMessage.request.arrLon,
              });
              setAutoMatchData(newMessage);
              setIsSuccess(true);
              console.log('SUCCESS...', newMessage.request);
              toast.success('매칭이 성공적으로 이루어졌습니다.', {
                onClick: successMatch,
                autoClose: 5000,
              });
              break;
            case 'MATCH_NOT_FOUND':
              console.log('MATCH_NOT_FOUND received, 30초 대기 진행 후 DELETE 요청 전송');
              intervalId.current = setInterval(() => {
                setProgress(prevProgress => {
                  if (prevProgress <= 0) {
                    clearInterval(intervalId.current as NodeJS.Timeout);
                    return 0;
                  }
                  return prevProgress - 100 / 30;
                });
              }, 1000);
              console.log('WAITTING...', newMessage.request);
              timeoutId.current = setTimeout(async () => {
                // console.log('Timeout reached, sending delete request');
                toast.error('근처에 매칭 대상이 없습니다.', {
                  autoClose: 4000,
                });
                try {
                  const response = await axios.delete(
                    `${ViteConfig.VITE_BASE_URL}/api/matches/${id}`,
                    {
                      headers: {
                        AUTHORIZATION: `Bearer ${getCookie('Authorization')}`,
                      },
                    },
                  );

                  // console.log('Delete request successful:', response);
                  setIsLoading(false);
                } catch (err) {
                  console.error('Match ID DELETE Request failed:', err);
                }
              }, 30000);
              break;
            case 'ALREADY_REQUEST':
              closeAutoMatchModal();
              toast.error('이미 요청이 진행중입니다!');
              break;
            default:
              console.warn('Unknown message type:', newMessage.type);
          }
        },
        {
          token: `${getCookie('Authorization')}`,
        },
      );

      return () => {
        subscription.unsubscribe();
        if (timeoutId.current !== null) {
          clearTimeout(timeoutId.current as NodeJS.Timeout);
        }
        if (intervalId.current !== null) {
          clearInterval(intervalId.current as NodeJS.Timeout);
        }
      };
    }
  }, [matchClient, isMatchConnected]);

  useEffect(() => {
    const getPartyData = async () => {
      if (map) {
        const lat = map.getCenter()?.lat();
        const lng = map.getCenter()?.lng();
        setLatitude?.(lat as number);
        setLongitude?.(lng as number);

        console.log('MAP CENTER', lat, lng);
        try {
          const response = await jwtAxios.get(
            `/api/party-boards?page=0&size=50&sort=distance,asc&isToday=false&departuresDate=&gender=&category=&longitude=${lng}&latitude=${lat}`,
          );

          const { content } = response.data.data;
          // console.log('MAP PARTY DATA LIST', content);
          setPartyData(content);
          updateMarkers(content);
        } catch (error) {
          console.error('ERROR GET PARTY DATA', error);
        }
      }
    };

    getPartyData();
  }, [map, mapCenter]);

  const updateMarkers = (dataList: IParty[]) => {
    markers.forEach(marker => marker.setMap(null));
    const newMarkers = dataList.map(item => {
      const marker = new google.maps.Marker({
        position: new google.maps.LatLng(
          item.departuresLocation.latitude,
          item.departuresLocation.longitude,
        ),
        map,
        icon: {
          url: categoryIcons[item.category as keyof typeof categoryIcons],
          scaledSize: new google.maps.Size(50, 50),
        },
        draggable: false,
      });

      marker.addListener('click', () => {
        // console.log(item);
        setDetailParty(item);
        if (partyDetailModalRef.current) {
          partyDetailModalRef.current.showModal();
        }
      });

      return marker;
    });

    setMarkers(newMarkers);
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  useEffect(() => {
    if (isAutoMatch) {
      openAutoMatchModal();
    }
  }, [isAutoMatch]);

  let autoMatchModal = (
    <>
      <dialog
        ref={autoMatchModalRef}
        id='my_modal_4'
        className={`modal ${isOpen ? 'open' : 'close'}`}>
        <div className='modal-box w-11/12 h-[60%] bg-white flex flex-col'>
          <h3 className='font-bold text-black text-[20px]'>자동 매칭</h3>
          <div className='mt-1 border border-gray-300'></div>
          {isLoading === false ? (
            <>
              <div className='h-[40%] mx-8 mt-5 rounded-xl flex flex-col items-center justify-center overflow-hidden'>
                <AutoPartyMap />
              </div>
              <div className='h-[30%] mx-8 mt-5'>
                <div className='w-[100%] h-[50%] flex justify-between'>
                  <div className='w-[8%] h-[100%]'>
                    <SvgDepartureMarker width={'100%'} height={'100%'} />
                  </div>
                  <div className='w-[85%]' onClick={goSetDeparture}>
                    <div className='flex justify-between'>
                      <div className='font-bold mb-1 text-[17px] text-black'>
                        {!!depName ? depName : '내 위치'}
                      </div>
                      <div className='w-[10%] flex justify-center items-center'>
                        <img src={Front} alt='출발지 설정' />
                      </div>
                    </div>
                    <div className='text-gray-500'>출발지</div>
                  </div>
                </div>
                <div className='w-[100%] h-[50%] flex justify-between'>
                  <div className='w-[8%] h-[100%]'>
                    <SvgArrivalMarker width={'100%'} height={'35px'} />
                  </div>
                  <div className='w-[85%]' onClick={goSetArrival}>
                    <div className='flex justify-between'>
                      <div className='font-bold mb-1 text-[17px] text-black'>{arrName}</div>
                      <div className='w-[10%] flex justify-center items-center'>
                        <img src={Front} alt='도착지 설정' />
                      </div>
                    </div>
                    <div className='text-gray-500'>도착지</div>
                  </div>
                </div>
              </div>
            </>
          ) : isSuccess === true ? (
            <>
              <div className='w-[100%] h-[100%] flex flex-col items-center'>
                <div className='w-[100%] h-[40%] mx-8 mt-5 rounded-xl flex flex-col items-center justify-center overflow-hidden'>
                  <AutoPartyMap />
                </div>
                <div className='w-[80%] h-[30%] mx-8 mt-4'>
                  <div className='w-[100%] h-[50%] flex'>
                    <div className='w-[30%] text-[17px] text-black self-end'>출발지 : </div>
                    <div className='w-[60%] self-end'>
                      <div className='font-bold text-[17px] text-gray-600'>
                        {truncateText(autoMatchData.request.depName as string, 8)}
                      </div>
                    </div>
                  </div>
                  <div className='w-[100%] h-[50%] flex'>
                    <div className='w-[30%] text-[17px] text-black self-center'>도착지 : </div>
                    <div className='w-[60%] self-center'>
                      <div className='font-bold text-[17px] text-gray-600'>
                        {truncateText(autoMatchData.request.arrName as string, 8)}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className='btn mt-4 w-[40%] bg-OD_GREEN text-black font-bold border-none'
                  onClick={successMatch}>
                  상세 결과 보기
                </button>
              </div>
            </>
          ) : (
            <>
              <div className='w-[100%] h-[100%] flex flex-col items-center'>
                <div className='w-[100%] h-[40%] mx-8 mt-5 rounded-xl flex flex-col items-center justify-center overflow-hidden'>
                  <AutoPartyMap />
                </div>
                <div className='w-[100%] h-[25%] flex flex-col justify-evenly items-center'>
                  <div className='text-gray-500 font-semibold text-[20px]'>매칭 대기중</div>
                  <div className='text-gray-500'>30초 이후 매칭신청이 종료됩니다!</div>
                  <div className='w-[80%] bg-gray-200 rounded-lg overflow-hidden'>
                    <div
                      className='bg-blue-500 h-4 transition-all duration-1000 ease-linear rounded-full'
                      style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
                <div className='w-[80%] h-[15%] mx-8'>
                  <div className='w-[100%] h-[50%] flex'>
                    <div className='w-[30%] text-[17px] text-gray-500 self-end'>출발지 : </div>
                    <div className='w-[60%] self-end'>
                      <div className='font-bold text-[17px] text-black'>
                        {reqAutoMatchData.depName}
                      </div>
                    </div>
                  </div>
                  <div className='w-[100%] h-[50%] flex'>
                    <div className='w-[30%] text-[17px] text-gray-500 self-center'>도착지 : </div>
                    <div className='w-[60%] self-center'>
                      <div className='font-bold text-[17px] text-black'>
                        {reqAutoMatchData.arrName}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className='btn mt-2 w-[30%] bg-OD_PURPLE text-white border-none'
                  onClick={reqCancelMatch}>
                  매칭 취소
                </button>
              </div>
            </>
          )}

          <div className='modal-action'>
            <form method='dialog'>
              <button
                className='btn btn-sm btn-circle btn-ghost absolute right-5 top-5 text-black'
                onClick={() => {
                  setIsSuccess(false);
                  setIsLoading(false);
                  setIsAutoMatch(false);
                  setDep?.('내 위치', { latitude: currentLat, longitude: currentLng });
                  setArr?.('도착지를 설정해 주세요.', { latitude: 0, longitude: 0 });
                }}>
                ✕
              </button>
            </form>
          </div>
          {isLoading === false && isSuccess === false && (
            <button className='btn bg-OD_PURPLE text-white border-none' onClick={reqAutoMatch}>
              자동매칭 신청
            </button>
          )}
        </div>
      </dialog>
    </>
  );

  let markerDetail = (
    <>
      {detailParty && (
        <dialog
          ref={partyDetailModalRef}
          id='my_modal_4'
          className={`modal ${isOpen ? 'open' : 'close'}`}>
          <div className='modal-box w-11/12 h-[80%] bg-white flex flex-col'>
            <h3 className='font-bold text-black text-[20px]'>{detailParty.title}</h3>

            <div className='mt-1 border border-gray-300'></div>
            <div className='w-[100%] h-[50%] rounded-xl flex flex-col items-center justify-center overflow-hidden mt-5'>
              <PartyItemMap
                departuresLocation={detailParty.departuresLocation}
                arrivalsLocation={detailParty.arrivalsLocation}
              />
            </div>
            <div className='w-[100%] h-[40%] border rounded-xl mt-5 p-3 cursor-pointer flex flex-col gap-2 justify-center'>
              <div className='w-[100%] h-[15%] flex items-center gap-3'>
                <div
                  className={`py-[2px] px-1 border ${categoryColorList[detailParty.category]} rounded-lg text-[13px] font-semibold`}>
                  {categoryList[detailParty.category]}
                </div>
                <div className='py-[2px] px-1 border border-gray-200 bg-gray-200 rounded-lg text-gray-500 text-[13px] font-semibold'>
                  {genderRestrictionList[detailParty.genderRestriction]}
                </div>
                <div className='py-[2px] px-1 text-gray-500 text-[13px] ml-auto '>
                  {calcDate(detailParty.departuresDate)}
                </div>
              </div>
              {/* <div className='w-[100%] h-[25%] flex items-center text-[18px] font-bold'>
                {detailParty.title}
              </div> */}
              <div className='w-[100%] h-[15%] flex items-center gap-2 text-gray-500 mt-2'>
                <SvgRouteIcon />
                <div>{detailParty.departuresName}</div>
                <div>{'->'}</div>
                <div>{detailParty.arrivalsName}</div>
              </div>
              <div className='w-[100%] h-[15%] flex items-center gap-2 text-gray-500'>
                <SvgTimerIcon />
                <div>{formatDate(detailParty.departuresDate)}</div>
              </div>
              <div className='w-[100%] h-[30%] flex items-center gap-4'>
                <div className='w-[40px] h-[40px] flex items-center rounded-full overflow-hidden'>
                  <img src={detailParty.organizer.profileImage} alt='파티장 프로필' />
                </div>
                <div
                  className={`py-[2px] px-1 border ${stateColorList[detailParty.state]} rounded-lg text-[13px] font-semibold`}>
                  {partyStateList[detailParty.state]}
                </div>
                <div className='w-[40%] h-[15%] flex justify-end items-center gap-2 text-gray-500 ml-auto mr-4'>
                  <SvgParticipantsIcon />
                  <div className='text-[13px]'>{`${detailParty.currentParticipants} / ${detailParty.maxParticipants}`}</div>
                </div>
              </div>
            </div>
            <div className='modal-action'>
              <form method='dialog'>
                <button className='btn btn-sm btn-circle btn-ghost absolute right-5 top-5 text-black'>
                  ✕
                </button>
              </form>
            </div>
            <button
              className='btn w-[100%] bg-OD_PURPLE text-white font-bold text-[18px] border-none'
              onClick={() => {
                nav(`/party/${detailParty.id}`);
              }}>
              상세 결과 보기
            </button>
          </div>
        </dialog>
      )}
    </>
  );

  const changeCurLocModalRef = useRef<HTMLDialogElement>(null);
  const [isOpenChangeCurLoc, setIsOpenChangeCurLoc] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState<string>('');
  const [searchData, setSearchData] = useState<IPlaceInfo[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<IPlaceInfo | null>(null);

  const openChangeCurLocModal = () => {
    if (changeCurLocModalRef.current) {
      setIsOpenChangeCurLoc(true);
      changeCurLocModalRef.current.showModal();
    }
  };

  const handleSearch = () => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  };

  const failRequest = () => {
    setSearchData([]);
    return toast.error('검색 결과가 없습니다.', { toastId: 'arrivalSearch' });
  };

  const getSearchData = async (searchValue: string) => {
    if (searchValue === '') {
      setSearchData([]);
      return;
    }
    try {
      const res = await jwtAxios.get(
        `/api/places?query=${searchValue}&latitude=${currentLat}&longitude=${currentLng}`,
      );
      // console.log(res.data.data.content);
      setSearchData(res.data.data.content);
    } catch (error) {
      failRequest();
    }
    // console.log(res);
  };

  const getLocationBySearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    getSearchData(e.target.value);
  };

  const handleChangeCurrentLocation = () => {
    if (selectedLocation && map) {
      const newCenter = new google.maps.LatLng(
        selectedLocation.geoPoint!.latitude,
        selectedLocation.geoPoint!.longitude,
      );
      map.setCenter(newCenter);
      setCurLocAdd(
        selectedLocation.roadNameAddress || selectedLocation.jibunAddress || '장소 정보 미제공',
      );
      setIsOpenChangeCurLoc(false);
      changeCurLocModalRef.current?.close();
    }
  };

  let changeCurLocModal = (
    <>
      <dialog
        ref={changeCurLocModalRef}
        id='my_modal_4'
        className={`modal ${isOpenChangeCurLoc ? 'open' : 'close'}`}>
        <div className='modal-box w-11/12 h-[80%] bg-white flex flex-col' onClick={handleSearch}>
          <h3 className='font-bold text-black text-[20px]'>위치 변경</h3>
          <div className='mt-1 border border-gray-300'></div>
          <div className='w-[100%] h-[10%] z-10 flex justify-center items-center relative'>
            <div className='w-[100%] h-[60%] flex justify-between items-center px-3 py-2 z-10 absolute left-0 top-[20%]'>
              <SvgSearch />
              <SvgGoTo />
            </div>
            <input
              type='text'
              ref={searchRef}
              value={search}
              className='w-[100%] h-[60%] flex items-center bg-black rounded-xl pl-10 pr-10 py-2 text-white relative'
              placeholder='어디로 가고싶으신가요?'
              onChange={getLocationBySearch}
            />
          </div>
          <div className='w-[100%] h-[70%]'>
            {searchData.length !== 0 ? (
              <div className='w-[100%] h-[100%] overflow-y-auto'>
                {searchData.map(data => (
                  <SearchDataItem
                    key={data.id}
                    {...data}
                    setSelectedLocation={setSelectedLocation}
                  />
                ))}
              </div>
            ) : (
              <div className='w-[100%] h-[100%] flex justify-center items-center font-semibold text-[18px]'>
                검색 결과가 없습니다.
              </div>
            )}
          </div>

          <div className='modal-action'>
            <form method='dialog'>
              <button className='btn btn-sm btn-circle btn-ghost absolute right-5 top-5 text-black'>
                ✕
              </button>
            </form>
          </div>
          <button
            className='btn w-[100%] bg-OD_PURPLE text-white font-bold text-[18px] border-none'
            onClick={handleChangeCurrentLocation}>
            현 위치 변경
          </button>
        </div>
      </dialog>
    </>
  );

  return (
    <>
      <div className='w-[100%] h-[100%]'>
        <div className='fixed w-[100%] h-[5%] bg-black z-10 flex items-center'>
          <div className='w-[80%] flex text-[18px] font-semibold text-white pl-3'>
            {`${curLocAdd.split(' ')[0]} ${curLocAdd.split(' ')[1] === undefined ? '' : curLocAdd.split(' ')[1]} ${curLocAdd.split(' ')[2] === undefined ? '' : curLocAdd.split(' ')[2]}`}
            <div
              className='flex justify-center items-center px-2 cursor-pointer'
              onClick={openChangeCurLocModal}>
              <div className='border border-slate-500 rounded-full px-2 text-[12px]'>변경</div>
            </div>
          </div>

          <div className='w-[20%] flex justify-end pr-3'>
            <div
              className='px-2 z-10 cursor-pointer'
              onClick={() => {
                nav('/chatlist');
              }}>
              <SvgChat />
            </div>
            <div
              className='px-2 z-10 cursor-pointer'
              onClick={() => {
                nav('/profile');
              }}>
              <SvgProfile />
            </div>
          </div>
        </div>
        <div
          className='fixed w-[50px] h-[50px] bottom-[30%] right-[3%] z-10 flex flex-col justify-center items-center bg-black rounded-full cursor-pointer'
          onClick={goCurrentLoc}>
          <SvgCurLoc style={{ display: 'flex' }} />
        </div>
        <div ref={ref} id='map' className='w-[100%] h-[100%]' />
        <button
          className='absolute btn z-10 w-[15%] h-[5%] bottom-[10%] right-[3%] border-none bg-black text-white hover:text-OD_GREEN'
          onClick={goCreateParty}>
          파티 생성
        </button>
        {'자동 매칭 모달' && autoMatchModal}
        <button
          className='absolute btn z-10 w-[15%] h-[5%] bottom-[20%] right-[3%] border-none bg-black text-white hover:text-OD_GREEN'
          onClick={openAutoMatchModal}>
          자동 매칭
        </button>
        <BottomSheet />
        {markerDetail}
        {changeCurLocModal}
      </div>
    </>
  );
};

export default MapRef;
