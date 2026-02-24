const motionToggle = document.querySelector("#motion-toggle");
const filterButtons = document.querySelectorAll(".filter-btn");
const clipsGrid = document.querySelector("#clips-grid");
const buildGallery = document.querySelector("#build-gallery");
const contactForm = document.querySelector("#contact-form");
const toast = document.querySelector("#toast");

const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");
const lightboxPrev = document.querySelector("#lightbox-prev");
const lightboxNext = document.querySelector("#lightbox-next");
const lightboxClose = document.querySelector("#lightbox-close");

const BUILD_IMAGES = [
  { src: "images/build-01.jpg", caption: "Modern Tower Block" },
  { src: "images/build-02.jpg", caption: "Neon City Avenue" },
  { src: "images/build-03.jpg", caption: "Glass Skybridge Hub" },
  { src: "images/build-04.jpg", caption: "Cyber Transit Center" },
  { src: "images/build-05.jpg", caption: "Luxury Penthouse Interior" },
  { src: "images/build-06.jpg", caption: "Riverside Night District" },
];

const CLIPS = [
  {
    game: "cs2",
    type: "youtube",
    title: "CS2 Short Highlight",
    url: "https://www.youtube.com/shorts/VVnmMqMdX_w",
  },
  {
    game: "cs2",
    type: "youtube",
    title: "CS2 Match Play",
    url: "https://www.youtube.com/watch?v=h6-NFmosRCw",
  },
  {
    game: "mc",
    type: "youtube",
    title: "Minecraft Build Showcase",
    url: "https://www.youtube.com/watch?v=DrUg_7gh4Pw",
  },
  {
    game: "mc",
    type: "youtube",
    title: "Minecraft Short Clip",
    url: "https://www.youtube.com/shorts/UmaWYA579Lc",
  },
];

const systemReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const storedMotion = localStorage.getItem("gameplon-motion");
let revealObserver;
let toastTimer;
let activeFilter = "all";
let lightboxIndex = 0;
let isReducedMotion = false;

function placeholderSvgData(label) {
  const safeLabel = encodeURIComponent(label);
  return `data:image/svg+xml,${
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E" +
    "%3Crect width='800' height='450' fill='%230b1327'/%3E" +
    "%3Crect x='20' y='20' width='760' height='410' rx='18' fill='none' stroke='%235f8ee5' stroke-width='3' stroke-dasharray='10 10'/%3E" +
    `%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%238fd6ff' font-size='36' font-family='Arial'%3E${safeLabel}%3C/text%3E` +
    "%3C/svg%3E"
  }`;
}

function attachImageFallback(img, label) {
  img.addEventListener(
    "error",
    () => {
      img.src = placeholderSvgData(label);
      img.classList.add("is-fallback");
    },
    { once: true }
  );
}

function youtubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "");
    }
    if (parsed.searchParams.has("v")) {
      return parsed.searchParams.get("v");
    }
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    return pathParts[pathParts.length - 1] || "";
  } catch {
    return "";
  }
}

function clipThumbnail(clip) {
  if (clip.type === "youtube") {
    const id = youtubeVideoId(clip.url);
    if (id) {
      return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
  }

  if (clip.thumb) {
    return clip.thumb;
  }

  return placeholderSvgData("Clip Placeholder");
}

function setupRevealObservers(reducedMotion) {
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = undefined;
  }

  const revealItems = document.querySelectorAll(".reveal");
  revealItems.forEach((item) => item.classList.remove("in-view"));

  if (reducedMotion) {
    revealItems.forEach((item) => item.classList.add("in-view"));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

function applyMotionPreference(reducedMotion) {
  isReducedMotion = reducedMotion;
  document.documentElement.classList.toggle("motion-reduced", reducedMotion);
  document.body.classList.toggle("motion-reduced", reducedMotion);

  if (motionToggle) {
    motionToggle.checked = reducedMotion;
  }

  setupRevealObservers(reducedMotion);
}

function renderBuildGallery() {
  if (!buildGallery) {
    return;
  }

  buildGallery.innerHTML = "";

  BUILD_IMAGES.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-btn reveal";
    button.dataset.index = String(index);

    button.innerHTML = `
      <figure class="gallery-item">
        <img src="${item.src}" alt="${item.caption}" class="local-img" />
        <figcaption>${item.caption}</figcaption>
      </figure>
    `;

    const img = button.querySelector("img");
    attachImageFallback(img, item.caption);

    button.addEventListener("click", () => openLightbox(index));
    buildGallery.appendChild(button);
  });
}

function openLightbox(index) {
  if (!lightbox || !lightboxImage || !lightboxCaption) {
    return;
  }

  lightboxIndex = index;
  const item = BUILD_IMAGES[lightboxIndex];
  lightboxImage.src = item.src;
  lightboxImage.alt = item.caption;
  lightboxCaption.textContent = item.caption;
  attachImageFallback(lightboxImage, item.caption);

  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  if (!lightbox) {
    return;
  }

  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
}

function stepLightbox(direction) {
  lightboxIndex = (lightboxIndex + direction + BUILD_IMAGES.length) % BUILD_IMAGES.length;
  openLightbox(lightboxIndex);
}

function renderClips() {
  if (!clipsGrid) {
    return;
  }

  clipsGrid.innerHTML = "";

  CLIPS.forEach((clip, index) => {
    const mappedGame = clip.game === "mc" ? "minecraft" : "cs2";
    const clipCard = document.createElement("article");
    clipCard.className = `clip-card reveal delay-${(index % 3) + 1}`;
    clipCard.dataset.game = mappedGame;

    const thumb = clipThumbnail(clip);
    const sourceLabel = clip.type.toUpperCase();

    clipCard.innerHTML = `
      <a class="clip-link" href="${clip.url}" target="_blank" rel="noreferrer">
        <div class="clip-thumb-wrap">
          <img class="clip-thumb local-img" src="${thumb}" alt="${clip.title}" />
          <div class="clip-thumb-overlay">
            <p class="clip-title">${clip.title}</p>
            <p class="clip-meta">${sourceLabel} • ${mappedGame === "cs2" ? "CS2" : "Minecraft"}</p>
          </div>
        </div>
      </a>
    `;

    const img = clipCard.querySelector("img");
    attachImageFallback(img, clip.title);

    clipsGrid.appendChild(clipCard);
  });

  applyClipFilter(activeFilter);
}

function applyClipFilter(filter) {
  activeFilter = filter;

  document.querySelectorAll(".clip-card").forEach((card) => {
    const show = filter === "all" || card.dataset.game === filter;
    card.style.display = show ? "block" : "none";
  });

  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("active", isActive);
  });
}

function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function initStaticImageFallbacks() {
  document.querySelectorAll("img.local-img[data-fallback]").forEach((img) => {
    const label = img.getAttribute("data-fallback") || "Image";
    attachImageFallback(img, label);
  });
}

function initEvents() {
  if (motionToggle) {
    motionToggle.addEventListener("change", (event) => {
      const reduced = event.target.checked;
      applyMotionPreference(reduced);
      localStorage.setItem("gameplon-motion", reduced ? "reduced" : "full");
    });
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyClipFilter(button.dataset.filter);
    });
  });

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      contactForm.reset();
      showToast("Message sent. I will reply soon.");
    });
  }

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener("click", () => stepLightbox(-1));
  }

  if (lightboxNext) {
    lightboxNext.addEventListener("click", () => stepLightbox(1));
  }

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!lightbox || !lightbox.classList.contains("is-open")) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "ArrowRight") {
      stepLightbox(1);
    }

    if (event.key === "ArrowLeft") {
      stepLightbox(-1);
    }
  });
}

const initialReducedMotion =
  storedMotion === "reduced" || (storedMotion === null && systemReduceMotion);

initStaticImageFallbacks();
renderBuildGallery();
renderClips();
initEvents();
applyMotionPreference(initialReducedMotion);
