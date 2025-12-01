import Image from 'next/image';
import loader from '@/assets/loader.gif';

const LoadingPage = () => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
      }}
    >
      <Image src={loader} height={150} width={150} alt='Chargement...' style={{ width: 'auto', height: 'auto' }} unoptimized />
    </div>
  );
};

export default LoadingPage;
