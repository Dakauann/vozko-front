import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { coverCrop } from "@/lib/studio/crop";
import type { CanvasSize, Layer, Transform } from "@/lib/studio/document";
import { clampTo } from "@/lib/studio/layer-ranges";

import { photo } from "./authoring";

export interface BenchPhoto {
  asset: string;
  width: number;
  height: number;
  subject: string;
  origin: string;
  generate?: string;
}

const UNSPLASH = "Unsplash License (https://unsplash.com/license, read 2026-10-11)";
const PEXELS = "Pexels License (https://www.pexels.com/license/, read 2026-10-11)";

function stock(asset: string, width: number, height: number, subject: string, page: string, author: string, license: string): BenchPhoto {
  return { asset, width, height, subject, origin: `${page} by ${author}, ${license}; downloaded at 1600 px wide` };
}

function generated(asset: string, width: number, height: number, subject: string, prompt: string): BenchPhoto {
  return { asset, width, height, subject, origin: "generated through the backend by the benchmark run", generate: prompt };
}

const PHOTO_CATALOG = {
  burger: stock("photo-burger.jpg", 1600, 1065, "cheeseburger on dark wood", "https://unsplash.com/photos/cheeseburger-with-fresh-vegetables-_qxbJUr9RqI", "Ilya Mashkov", UNSPLASH),
  latte: stock("photo-latte.jpg", 1600, 2400, "iced latte glass on white", "https://www.pexels.com/photo/minimalist-iced-coffee-on-white-background-38519285/", "mackling", PEXELS),
  living: stock("photo-living.jpg", 1600, 1067, "bright living room with grey sofas", "https://unsplash.com/photos/living-room-with-grey-velvet-sofas-mw_mj-noYHM", "Zac Gudakov", UNSPLASH),
  house: stock("photo-house.jpg", 1600, 2400, "modern house with pool at dusk", "https://unsplash.com/photos/water-poll-near-house-during-golden-hour-so3wgJLwDxo", "Roberto Nickson", UNSPLASH),
  dental: stock("photo-dental.jpg", 1600, 1067, "dental chair in a bright clinic", "https://unsplash.com/photos/dental-chair-in-clinical-office-XJptUS8nbhs", "Atikah Akhtar", UNSPLASH),
  law: stock("photo-law.jpg", 1600, 2400, "brass scales and gavel on a desk", "https://www.pexels.com/photo/judges-desk-with-gavel-and-scales-5669619/", "Sora Shimazaki", PEXELS),
  skincare: stock("photo-skincare.jpg", 1600, 2400, "unbranded pump bottle on orange", "https://unsplash.com/photos/a-bottle-of-lotion-on-an-orange-background-gUZv1Fdkfgw", "Birgith Roosipuu", UNSPLASH),
  sneaker: stock("photo-sneaker.jpg", 1600, 1067, "white sneakers on orange and yellow; frame the right shoe only, the left one shows a maker mark", "https://www.pexels.com/photo/stylish-white-sneakers-on-vibrant-background-35618110/", "Thang Nguyen", PEXELS),
  beach: stock("photo-beach.jpg", 1600, 1082, "tropical beach with palms", "https://unsplash.com/photos/a-tropical-beach-with-palm-trees-and-clear-water-BJ-FvNGCfEY", "Simon Spring", UNSPLASH),
  pizza: stock("photo-pizza.jpg", 1600, 1067, "sliced pizza on a wooden board", "https://unsplash.com/photos/cheese-pizza-with-tomatoes-and-rosemary-MQUqbmszGGM", "Ivan Torres", UNSPLASH),
  cake: stock("photo-cake.jpg", 1600, 2408, "chocolate mousse cake", "https://unsplash.com/photos/chocolate-mousse-cake-with-sugar-pearls-hcEDfkiVmMI", "kaouther djouada", UNSPLASH),
  ornaments: stock("photo-ornaments.jpg", 1600, 1067, "red, gold and silver baubles", "https://unsplash.com/photos/red-gold-white-and-silver-decorations-r0eEDn1GAKw", "freestocks", UNSPLASH),
  botanical: stock("photo-botanical.jpg", 1600, 2400, "green leaves and yellow flowers on white", "https://unsplash.com/photos/green-leaves-and-yellow-flowers-arranged-on-white-Cm-_g12qOFE", "Candes J", UNSPLASH),
  headphones: stock("photo-headphones.jpg", 1600, 1200, "white headphones on yellow", "https://www.pexels.com/photo/modern-white-headphones-on-bright-yellow-background-28739256/", "Andrey Matveev", PEXELS),
  skyline: stock("photo-skyline.jpg", 1600, 1200, "city skyline at dusk", "https://unsplash.com/photos/a-view-of-a-city-skyline-at-dusk-Vq1lxH5TeQ0", "Calvin Ma", UNSPLASH),
  bowl: stock("photo-bowl.jpg", 1600, 1067, "smoothie bowl with banana and raspberries, top view on light grey", "https://unsplash.com/photos/a-bowl-of-food-with-bananas-raspberries-and-powdered-sugar-um4ltfeEaec", "Christian Wiediger", UNSPLASH),
  sleepingDog: stock("photo-sleepingDog.jpg", 1600, 1067, "black and white dog asleep on a floor, side view", "https://unsplash.com/photos/a-black-and-white-dog-laying-on-the-floor-TDYYA0nn03A", "Madeline Liu", UNSPLASH),
  potPlant: stock("photo-potPlant.jpg", 1600, 2844, "small succulent in a white pot on grey", "https://unsplash.com/photos/a-plant-in-a-pot-on-a-gray-background--CHU5URjLLQ", "Jor Eg", UNSPLASH),
  coffeeRed: stock("photo-coffeeRed.jpg", 1600, 1067, "white coffee cup on a saucer against red", "https://unsplash.com/photos/a-cup-of-coffee-sitting-on-top-of-a-white-plate-fj11X2c4ui8", "Daniel Dan", UNSPLASH),
  villa: stock("photo-villa.jpg", 1600, 1203, "white modern two storey house with garden, daylight", "https://unsplash.com/photos/modern-two-story-house-with-clean-lines-and-large-windows-WZ3IMJ1DoeQ", "WILLIAN REIS", UNSPLASH),
  roomBright: stock("photo-roomBright.jpg", 1600, 2400, "bright white room with a round table and chair", "https://unsplash.com/photos/white-steel-chair-in-front-round-table-on-white-rug-X5BWooeO4Cw", "Hutomo Abrianto", UNSPLASH),
  roomChairs: stock("photo-roomChairs.jpg", 1600, 2133, "white room with rattan chairs and a potted plant", "https://unsplash.com/photos/a-white-room-with-three-chairs-and-a-potted-plant-S-StGkmIEFw", "Martin Lysek", UNSPLASH),
  orchid: stock("photo-orchid.jpg", 1600, 1600, "single white orchid flower on black", "https://unsplash.com/photos/a-single-white-orchid-with-a-yellow-center-_tkmZYHVHhY", "Brigitte Elsner", UNSPLASH),
  sneakersDark: stock("photo-sneakersDark.jpg", 1600, 2133, "white canvas sneakers on a dark floor in a beam of light", "https://unsplash.com/photos/a-pair-of-white-sneakers-sitting-on-top-of-a-wooden-floor-qO_w1RP1as4", "Zach Camp", UNSPLASH),
  carDoor: stock("photo-carDoor.jpg", 1600, 1200, "dark car door and handle at night", "https://unsplash.com/photos/a-car-parked-in-the-dark-with-its-door-open-mMp3TBFFTtg", "Siddharth", UNSPLASH),
  roastChicken: stock("photo-roastChicken.jpg", 1600, 1200, "roast chicken in a cast iron pan with rosemary; frame the chicken, the pan handle carries a maker mark", "https://unsplash.com/photos/grilled-meat-on-black-round-plate-YMkX5NjURhk", "Cisco Lin", UNSPLASH),
  chili: stock("photo-chili.jpg", 1600, 2133, "two red chili peppers on a dark surface", "https://unsplash.com/photos/two-red-chili-peppers-on-a-dark-surface-wzWfCsbJvS0", "Aga Silva", UNSPLASH),
  sneakerCutout: generated("photo-sneaker-cutout.png", 1024, 1024, "single sneaker cutout on transparent background", "Foto de produto de um tênis de corrida branco com detalhes laranja, sem marca, sem logotipo e sem texto, visto de lado e levemente inclinado para cima, recortado sobre fundo totalmente transparente, luz de estúdio suave, PNG 1024 x 1024"),
} as const satisfies Record<string, BenchPhoto>;

export type PhotoSlot = keyof typeof PHOTO_CATALOG;

const PHOTOS: Record<PhotoSlot, BenchPhoto> = PHOTO_CATALOG;

export const PHOTO_DIR = process.env.ELO_BENCH_PHOTOS ?? "";

export function benchPhotos(): (BenchPhoto & { slot: PhotoSlot })[] {
  return (Object.keys(PHOTOS) as PhotoSlot[]).map((slot) => ({ slot, ...PHOTOS[slot] }));
}

export function photoAsset(slot: PhotoSlot): string {
  return PHOTOS[slot].asset;
}

function photoFile(entry: BenchPhoto & { slot: PhotoSlot }): string {
  return PHOTO_DIR ? join(PHOTO_DIR, entry.slot, entry.asset) : "";
}

export function missingPhotos(): (BenchPhoto & { slot: PhotoSlot })[] {
  return benchPhotos().filter((entry) => !photoFile(entry) || !existsSync(photoFile(entry)));
}

export function writePhotoFixtures(dir: string): void {
  const missing = new Set(missingPhotos().map((entry) => entry.slot));
  for (const entry of benchPhotos()) if (!missing.has(entry.slot)) copyFileSync(photoFile(entry), join(dir, entry.asset));
}

export function placedPhoto(id: string, slot: PhotoSlot, transform: Transform, canvas: CanvasSize, extra: Partial<Layer> = {}, focusX = 0.5, focusY = 0.5): Layer {
  const natural = PHOTOS[slot];
  const { w, h } = coverCrop(natural, transform, canvas) ?? { w: 1, h: 1 };
  const x = clampTo(focusX - w / 2, [0, 1 - w]);
  const y = clampTo(focusY - h / 2, [0, 1 - h]);
  return photo(id, natural.asset, transform, { crop: { x, y, w, h }, ...extra });
}

export function photoIn(frame: Layer, slot: PhotoSlot, canvas: CanvasSize, focusX = 0.5, focusY = 0.5, extra: Partial<Layer> = {}): Layer[] {
  return [frame, placedPhoto(`${frame.id}_photo`, slot, { ...frame.transform, opacity: 1 }, canvas, { clip: true, ...extra }, focusX, focusY)];
}
