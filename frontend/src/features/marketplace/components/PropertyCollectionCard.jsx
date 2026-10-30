import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../../app/motion.js';
export function PropertyCollectionCard({ item, properties }) {
  const photos = [
    ...new Map(
      properties
        .filter((property) => item.matches.includes(String(property.propertyType).toLowerCase()))
        .flatMap((property) =>
          (property.images || [])
            .filter(Boolean)
            .map((src) => [src, { src, title: property.title }]),
        ),
    ).values(),
  ];
  const photoKey = photos.map((photo) => photo.src).join('|');
  const [imageIndex, setImageIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!photos.length) {
      setImageIndex(0);
      return undefined;
    }
    const startingIndex = Math.floor(Math.random() * photos.length);
    setImageIndex(startingIndex);
    if (photos.length < 2 || reducedMotion) return undefined;
    let timeout;
    let active = true;
    const rotate = () => {
      timeout = window.setTimeout(
        () => {
          if (!active) return;
          setImageIndex((current) => {
            const offset = 1 + Math.floor(Math.random() * (photos.length - 1));
            return ((current % photos.length) + offset) % photos.length;
          });
          rotate();
        },
        12000 + Math.floor(Math.random() * 6000),
      );
    };
    rotate();
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [photoKey, photos.length, reducedMotion]);

  const currentPhoto = photos[imageIndex];
  return (
    <Link
      className={`collection-card${currentPhoto ? '' : ' collection-card-empty'}`}
      to={`/properties?propertyType=${item.type}`}
    >
      {currentPhoto ? (
        <img
          key={currentPhoto.src}
          src={currentPhoto.src}
          alt={`${item.title} listing: ${currentPhoto.title}`}
          loading="lazy"
        />
      ) : (
        <span className="collection-no-photo" aria-hidden="true">
          New listings welcome
        </span>
      )}
      <span className="collection-shade" />
      <span className="collection-copy">
        <strong>{item.title}</strong>
        <small>{item.subtitle}</small>
      </span>
      <span className="collection-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
