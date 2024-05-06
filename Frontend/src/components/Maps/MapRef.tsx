import { useEffect, useRef, useState } from 'react';
import LatLngAddStore from '@/stores/useLatLngAddStore';
import DarkModeStyle from './DarkModeStyle';
import mapStore from '@/stores/useMapStore';
import { Layout } from '../Layout';
import { useNavigate } from 'react-router-dom';

const MapRef = () => {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const { setGoogleMap } = mapStore();

  const { currentLat, currentLng } = LatLngAddStore();

  const goCreateParty = () => {
    nav('/party-boards');
  };

  useEffect(() => {
    if (ref.current) {
      const initialMap = new window.google.maps.Map(ref.current, {
        center: {
          lat: currentLat,
          lng: currentLng,
        },
        disableDefaultUI: true,
        styles: DarkModeStyle,
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

      setGoogleMap(initialMap);
    }
  }, []);

  return (
    <Layout>
      <div ref={ref} id='map' className='w-[100%] h-[100%]' />
      <button
        className='btn z-10 w-[15%] h-[5%] absolute right-0 bottom-[10%]'
        onClick={goCreateParty}>
        글 생성 가보자!
      </button>
    </Layout>
  );
};

export default MapRef;
