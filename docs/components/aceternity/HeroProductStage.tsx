"use client";

import { useState } from "react";

const productImageSizes = "(max-width: 760px) calc(100vw - 36px), (max-width: 1040px) calc(100vw - 56px), 1180px";

const productSlides = [
  {
    src: "/screenshot-light.png",
    webpSrc: "/screenshots/chiron-horizon-light-1280.webp",
    webpSrcSet: "/screenshots/chiron-horizon-light-768.webp 768w, /screenshots/chiron-horizon-light-1280.webp 1280w, /screenshots/chiron-horizon-light-2560.webp 2560w",
    alt: "Chiron Horizon main window light theme",
    label: "Light",
  },
  {
    src: "/screenshot-dark.png",
    webpSrc: "/screenshots/chiron-horizon-dark-1280.webp",
    webpSrcSet: "/screenshots/chiron-horizon-dark-768.webp 768w, /screenshots/chiron-horizon-dark-1280.webp 1280w, /screenshots/chiron-horizon-dark-2560.webp 2560w",
    alt: "Chiron Horizon main window dark theme",
    label: "Dark",
  },
  {
    src: "/screenshot-er.png",
    webpSrc: "/screenshots/chiron-horizon-er-1280.webp",
    webpSrcSet: "/screenshots/chiron-horizon-er-768.webp 768w, /screenshots/chiron-horizon-er-1280.webp 1280w, /screenshots/chiron-horizon-er-2560.webp 2560w",
    alt: "Chiron Horizon ER diagram",
    label: "ER Diagram",
  },
  {
    src: "/screenshot-grid.png",
    webpSrc: "/screenshots/chiron-horizon-grid-1280.webp",
    webpSrcSet: "/screenshots/chiron-horizon-grid-768.webp 768w, /screenshots/chiron-horizon-grid-1280.webp 1280w, /screenshots/chiron-horizon-grid-2560.webp 2560w",
    alt: "Chiron Horizon data grid",
    label: "Data Grid",
  },
];

export function HeroProductStage() {
  const [activeSlide, setActiveSlide] = useState(0);

  const preloadSlide = (index: number) => {
    if (index === activeSlide) return;
    const image = new Image();
    image.srcset = productSlides[index].webpSrcSet;
    image.sizes = productImageSizes;
    image.src = productSlides[index].webpSrc;
  };

  const slide = productSlides[activeSlide];

  return (
    <div
      className="landing-product relative w-full mt-16 mb-12 overflow-hidden rounded-2xl max-[1040px]:max-w-[900px] max-[1040px]:mt-14 max-[760px]:mt-10 max-[760px]:mb-7 max-[760px]:rounded-xl"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <picture key={slide.src}>
          <source type="image/webp" srcSet={slide.webpSrcSet} sizes={productImageSizes} />
          <img
            alt={slide.alt}
            className="landing-product-slide absolute inset-0 z-[1] w-full h-full object-cover object-left-top"
            decoding="async"
            fetchPriority={activeSlide === 0 ? "high" : "auto"}
            loading={activeSlide === 0 ? "eager" : "lazy"}
            sizes={productImageSizes}
            src={slide.src}
          />
        </picture>
      </div>
      <div className="landing-product-dots absolute right-[18px] bottom-4 z-[5] flex items-center rounded-full p-1 max-[760px]:right-2 max-[760px]:bottom-2" aria-label="Chiron Horizon product screenshots">
        {productSlides.map((slide, index) => (
          <button aria-current={index === activeSlide} aria-label={`Show ${slide.label} screenshot`} key={slide.src} onClick={() => setActiveSlide(index)} onFocus={() => preloadSlide(index)} onPointerEnter={() => preloadSlide(index)} title={slide.label} type="button" className="landing-product-dot block size-8 border-0 rounded-full p-0 cursor-pointer">
            <span>{slide.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
