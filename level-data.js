/* Mavi’nin Matematik Macerası — seviye verisi
 *
 * Oyun kodundan bağımsız, statik ve çevrimdışı güvenli veri dosyası.
 * index.html içinde game.js'den önce yüklenir; service worker önbelleğe alır.
 *
 * Koordinatlar dünya pikseli (dünya 7500 x 720). y ekseni aşağı doğru artar.
 *  platforms:  [x, y, genişlik, yükseklik, tür]  tür: "ground" (zemine kadar) | "grass" (yüzen)
 *  boxes:      [x, y]  soru kutusunun sol üst köşesi (54 x 54)
 *  coins:      ["line", x, yüzeyY, adet, aralık]      yüzey üstünde sıra
 *              ["arc", x0, y0, x1, y1, kavis, adet]   zıplama yayını gösteren coin dizisi (merkez noktaları)
 *              ["coin", x, yüzeyY]                    tek coin
 *  enemies:    [x, yüzeyY, devriyeMin, devriyeMax, hız]
 *  route:      başlangıçtan boss arenasına ana rota (platform sıra numaraları, sonda "arena")
 *
 * Boss arenası tüm seviyelerde aynıdır ve oyun tarafından eklenir (arena).
 * Fizik: zıplama ~318 px yükseklik, düz zeminde ~376 px yatay menzil; tasarım bunun rahatça altında kalır.
 */
(function (root) {
  "use strict";

  const data = {
    schemaVersion: 1,
    world: { width: 7500, height: 720 },
    // Başlangıç: tek doğruluk kaynağı. Geniş telefonlarda (çentikli dahil) Mavi sol alttaki joystick'in
    // arkasında kalmasın diye x=350 (ölçüm: en dar durumda çentikli 852x393'te ~21 CSS px boşluk).
    start: { x: 350, footY: 635 },
    arena: { platform: [6420, 625, 1080, 95, "ground"], start: 6420, end: 7480, floorY: 625 },
    arenaCoins: [["line", 6600, 625, 5, 48]],

    levels: [
      {
        id: 1,
        name: "Matematik Bahçesi",
        enemySpeed: 1,
        theme: {
          skyTop: "#70d4ff",
          skyMid: "#d5f6ff",
          skyBottom: "#9ddd78",
          sun: "#fff2a1",
          hill: "#5eb85d",
          grass: "#79dd66",
          groundTop: "#5fbd55",
          groundMid: "#4ea850",
          dirtTop: "#a86c3b",
          dirtBottom: "#7a4a2d",
          flag: "#ff6b57"
        },
        atmosphere: {
          name: "parlak-gunduz",
          light: { x: 150, y: 112, r: 58, kind: "sun" },
          glow: "rgba(255, 246, 190, 0.55)",
          cloud: "#ffffff",
          cloudAlpha: 0.9,
          mist: 0,
          stars: 0,
          far: "hills",
          mid: "trees",
          near: "flowers",
          platformStyle: "garden"
        },
        mathProfile: {
          focus: "Toplama ve çıkarma · Sonuçlar 20’ye kadar",
          add: { weight: 0.55, min: 1, maxResult: 20 },
          sub: { weight: 0.45, minA: 3, max: 20, minB: 1 },
          mul: null
        },
        // Geniş ve alçak platformlar, kısa boşluklar; ilk 1900 px düşmansız hareket öğretimi.
        platforms: [
          [0, 635, 900, 85, "ground"], // 0 başlangıç, öğretim alanı
          [1000, 625, 800, 95, "ground"], // 1
          [1910, 640, 800, 80, "ground"], // 2
          [2060, 480, 240, 34, "grass"], // 3 bonus
          [2820, 630, 780, 90, "ground"], // 4
          [3020, 470, 230, 34, "grass"], // 5 bonus
          [3340, 380, 200, 34, "grass"], // 6 bonus (üst)
          [3710, 645, 790, 75, "ground"], // 7
          [4630, 625, 770, 95, "ground"], // 8
          [4800, 470, 240, 34, "grass"], // 9 bonus
          [5140, 360, 220, 34, "grass"], // 10 bonus (üst)
          [5500, 625, 920, 95, "ground"] // 11 boss öncesi dinlenme alanı
        ],
        route: [0, 1, 2, 4, 7, 8, 11, "arena"],
        boxes: [
          [560, 391],
          [1380, 381],
          [2500, 396],
          [2900, 386],
          [3110, 236],
          [4250, 401],
          [4660, 381],
          [5750, 381]
        ],
        coins: [
          ["line", 460, 635, 5, 50], // ilk coin, başlangıçtaki oyuncunun 60+ px önünde
          ["arc", 870, 575, 1030, 565, 80, 5],
          ["line", 1100, 625, 4, 48],
          ["arc", 1765, 565, 1945, 580, 80, 4],
          ["line", 1990, 640, 3, 48],
          ["line", 2090, 480, 4, 48],
          ["arc", 2685, 580, 2855, 570, 80, 4],
          ["line", 3050, 470, 4, 45],
          ["line", 3370, 380, 3, 48],
          ["line", 3290, 630, 4, 48],
          ["arc", 3575, 570, 3745, 585, 80, 4],
          ["line", 3800, 645, 4, 48],
          ["arc", 4475, 585, 4665, 565, 90, 5],
          ["line", 4830, 470, 4, 46],
          ["line", 5165, 360, 4, 46],
          ["line", 5600, 625, 6, 48]
        ],
        enemies: [
          [2450, 640, 2350, 2660, 70],
          [4100, 645, 3950, 4450, 75],
          [5000, 625, 4900, 5360, 75]
        ]
      },

      {
        id: 2,
        name: "Sisli Vadi",
        enemySpeed: 1.1,
        theme: {
          skyTop: "#7b9cff",
          skyMid: "#d7e5ff",
          skyBottom: "#b6d78b",
          sun: "#ffe28d",
          hill: "#4b9f7b",
          grass: "#62c987",
          groundTop: "#42a86d",
          groundMid: "#32895d",
          dirtTop: "#6e6a73",
          dirtBottom: "#46445a",
          flag: "#55d6ff"
        },
        atmosphere: {
          name: "serin-vadi",
          light: { x: 1060, y: 96, r: 46, kind: "sun" },
          glow: "rgba(230, 245, 255, 0.45)",
          cloud: "#f2f8ff",
          cloudAlpha: 0.8,
          mist: 0.55,
          stars: 0,
          far: "peaks",
          mid: "pines",
          near: "ferns",
          platformStyle: "moss"
        },
        mathProfile: {
          focus: "100’e kadar toplama ve çıkarma · 2 ve 5 ile çarpma",
          add: { weight: 0.47, min: 5, maxResult: 100 },
          sub: { weight: 0.41, minA: 15, max: 100, minB: 3 },
          mul: { weight: 0.12, factors: [2, 5], min: 1, max: 10 }
        },
        // Basamaklı platformlar; alt güvenli rota ve daha çok coin veren üst rota.
        platforms: [
          [0, 635, 700, 85, "ground"], // 0
          [840, 600, 560, 120, "ground"], // 1
          [1000, 440, 250, 34, "grass"], // 2 üst rota U1
          [1380, 360, 230, 34, "grass"], // 3 üst rota U2
          [1540, 640, 700, 80, "ground"], // 4
          [1760, 470, 230, 34, "grass"], // 5 üst rota U3
          [2380, 560, 190, 34, "grass"], // 6 basamak (çukur üstü)
          [2670, 480, 200, 34, "grass"], // 7 basamak
          [2980, 620, 720, 100, "ground"], // 8
          [3150, 460, 250, 34, "grass"], // 9 üst rota U4
          [3860, 645, 740, 75, "ground"], // 10
          [4010, 490, 230, 34, "grass"], // 11 üst rota U5
          [4340, 390, 220, 34, "grass"], // 12 üst rota U6
          [4760, 560, 200, 34, "grass"], // 13 basamak (çukur üstü)
          [5100, 625, 700, 95, "ground"], // 14
          [5950, 625, 470, 95, "ground"] // 15 dinlenme alanı
        ],
        route: [0, 1, 4, 6, 7, 8, 10, 13, 14, 15, "arena"],
        boxes: [
          [450, 391],
          [1100, 206],
          [2080, 396],
          [3250, 226],
          [3500, 376],
          [4420, 166],
          [5400, 381],
          [6150, 381]
        ],
        coins: [
          ["line", 460, 635, 4, 50], // ilk coin, başlangıçtaki oyuncunun 60+ px önünde
          ["arc", 665, 575, 865, 540, 80, 5],
          ["line", 900, 600, 4, 48],
          ["line", 1030, 440, 4, 48],
          ["line", 1405, 360, 4, 45],
          ["line", 1790, 470, 4, 46],
          ["line", 1600, 640, 3, 48],
          ["arc", 2235, 585, 2400, 505, 70, 4],
          ["line", 2410, 560, 3, 48],
          ["arc", 2565, 505, 2690, 425, 60, 3],
          ["line", 2700, 480, 3, 48],
          ["arc", 2865, 425, 3010, 565, 60, 4],
          ["line", 3180, 460, 5, 45],
          ["line", 3420, 620, 3, 48],
          ["arc", 3695, 565, 3880, 590, 70, 4],
          ["line", 4040, 490, 4, 46],
          ["line", 4370, 390, 4, 46],
          ["arc", 4595, 590, 4780, 505, 70, 4],
          ["line", 4790, 560, 3, 48],
          ["arc", 4955, 505, 5120, 570, 60, 4],
          ["line", 5550, 625, 4, 48],
          ["line", 6000, 625, 3, 48]
        ],
        enemies: [
          [1800, 640, 1700, 2200, 80],
          [3300, 620, 3100, 3660, 82],
          [4200, 645, 4000, 4560, 84],
          [5400, 625, 5250, 5760, 86]
        ]
      },

      {
        id: 3,
        name: "Gün Batımı Kanyonu",
        enemySpeed: 1.15,
        theme: {
          skyTop: "#ff9f6e",
          skyMid: "#ffd3a8",
          skyBottom: "#f2b18c",
          sun: "#fff0a8",
          hill: "#c9794f",
          grass: "#e8b66a",
          groundTop: "#d99a55",
          groundMid: "#c07a42",
          dirtTop: "#b8643a",
          dirtBottom: "#7c3b26",
          flag: "#7e66ff"
        },
        atmosphere: {
          name: "gun-batimi-kanyonu",
          light: { x: 880, y: 430, r: 96, kind: "sun" },
          glow: "rgba(255, 190, 120, 0.6)",
          cloud: "#ffd9c4",
          cloudAlpha: 0.85,
          mist: 0.2,
          stars: 0,
          far: "mesas",
          mid: "rocks",
          near: "desert",
          platformStyle: "sandstone"
        },
        mathProfile: {
          focus: "100’e kadar toplama ve çıkarma · Çarpım tablosu (2–9)",
          add: { weight: 0.33, min: 8, maxResult: 100 },
          sub: { weight: 0.32, minA: 20, max: 100, minB: 5 },
          mul: { weight: 0.35, factors: [2, 3, 4, 5, 6, 7, 8, 9], min: 2, max: 9 }
        },
        // Kanyon sütunları, alçak/yüksek rota geçişleri ve giderek yükselen final.
        platforms: [
          [0, 635, 650, 85, "ground"], // 0
          [830, 600, 280, 120, "ground"], // 1 C1
          [1300, 560, 420, 160, "ground"], // 2 C2
          [1470, 380, 200, 34, "grass"], // 3 yüksek H1
          [1910, 650, 520, 70, "ground"], // 4 alçak L1
          [2560, 510, 210, 34, "grass"], // 5 yüksek H3
          [2900, 420, 200, 34, "grass"], // 6 yüksek H4
          [3230, 640, 700, 80, "ground"], // 7 alçak L2
          [4110, 590, 290, 130, "ground"], // 8 C3
          [4620, 540, 280, 180, "ground"], // 9 C4
          [5100, 600, 430, 120, "ground"], // 10 C5
          [5680, 555, 170, 165, "ground"], // 11 final R1
          [5990, 505, 170, 215, "ground"], // 12 final R2
          [6290, 460, 130, 260, "ground"], // 13 final R3
          [3450, 470, 220, 34, "grass"] // 14 yüksek H5 (isteğe bağlı)
        ],
        route: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, "arena"],
        boxes: [
          [420, 391],
          [950, 356],
          [1540, 156],
          [2150, 406],
          [2975, 186],
          [3800, 396],
          [4740, 296],
          [5200, 356]
        ],
        coins: [
          ["arc", 625, 575, 850, 540, 90, 5],
          ["line", 870, 600, 3, 48],
          ["arc", 1095, 540, 1320, 500, 90, 5],
          ["line", 1330, 560, 2, 48],
          ["line", 1490, 380, 4, 48],
          ["arc", 1705, 500, 1930, 590, 80, 5],
          ["line", 1980, 650, 4, 48],
          ["arc", 2415, 590, 2580, 450, 70, 4],
          ["line", 2590, 510, 3, 48],
          ["arc", 2755, 450, 2920, 360, 60, 4],
          ["arc", 3085, 360, 3250, 580, 50, 4],
          ["line", 3280, 640, 3, 48],
          ["line", 3480, 470, 4, 46],
          ["arc", 3915, 580, 4130, 530, 90, 5],
          ["line", 4160, 590, 4, 48],
          ["arc", 4385, 530, 4640, 480, 90, 5],
          ["arc", 4885, 480, 5120, 540, 80, 5],
          ["line", 5150, 600, 3, 48],
          ["arc", 5515, 540, 5700, 495, 70, 4],
          ["arc", 5835, 495, 6010, 445, 70, 4],
          ["arc", 6145, 445, 6310, 400, 60, 3]
        ],
        enemies: [
          [1500, 560, 1420, 1710, 85],
          [2200, 650, 2010, 2420, 88],
          [3600, 640, 3400, 3920, 90],
          [4780, 540, 4730, 4895, 70],
          [5350, 600, 5220, 5520, 92]
        ]
      },

      {
        id: 4,
        name: "Ayışığı Zirvesi",
        enemySpeed: 1.2,
        theme: {
          skyTop: "#3a3f9e",
          skyMid: "#7d7fd6",
          skyBottom: "#6f8fc0",
          sun: "#f6d36b",
          hill: "#4b5aa8",
          grass: "#7fd9d0",
          groundTop: "#6fb9c9",
          groundMid: "#4f8fa8",
          dirtTop: "#5d5a8f",
          dirtBottom: "#2f2c55",
          flag: "#ffd34d"
        },
        atmosphere: {
          name: "ayisigi-zirvesi",
          light: { x: 1040, y: 104, r: 38, kind: "moon" },
          glow: "rgba(220, 220, 255, 0.35)",
          cloud: "#c9cdf5",
          cloudAlpha: 0.5,
          mist: 0.25,
          stars: 90,
          far: "spires",
          mid: "crystals",
          near: "glow",
          platformStyle: "moonstone"
        },
        mathProfile: {
          focus: "Karışık işlemler · Çarpma ağırlıklı (2–9)",
          add: { weight: 0.28, min: 10, maxResult: 100 },
          sub: { weight: 0.27, minA: 25, max: 100, minB: 6 },
          mul: { weight: 0.45, factors: [2, 3, 4, 5, 6, 7, 8, 9], min: 2, max: 9 }
        },
        // Dar ama güvenli platformlar; yukarı-aşağı rota, kısa dinlenme alanları.
        platforms: [
          [0, 635, 600, 85, "ground"], // 0 başlangıç
          [760, 560, 210, 34, "grass"], // 1 P1
          [1110, 470, 200, 34, "grass"], // 2 P2
          [1460, 540, 200, 34, "grass"], // 3 P3
          [1810, 620, 480, 100, "ground"], // 4 R1
          [2440, 540, 200, 34, "grass"], // 5 P4
          [2790, 450, 190, 34, "grass"], // 6 P5
          [3130, 370, 190, 34, "grass"], // 7 P6 zirve
          [3470, 460, 210, 34, "grass"], // 8 P7
          [3830, 610, 650, 110, "ground"], // 9 R2
          [4630, 520, 200, 34, "grass"], // 10 P8
          [4980, 430, 260, 34, "grass"], // 11 P9
          [5390, 520, 190, 34, "grass"], // 12 P10
          [5730, 600, 290, 120, "ground"], // 13 R3 dinlenme
          [6160, 520, 160, 200, "ground"] // 14 final sütunu
        ],
        route: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, "arena"],
        boxes: [
          [380, 391],
          [1180, 236],
          [2000, 376],
          [2510, 306],
          [3195, 146],
          [4150, 366],
          [5020, 196],
          [5850, 356]
        ],
        coins: [
          ["arc", 560, 575, 780, 500, 80, 5],
          ["line", 790, 560, 3, 50],
          ["arc", 965, 500, 1130, 410, 70, 4],
          ["line", 1140, 470, 3, 48],
          ["arc", 1305, 410, 1480, 480, 70, 4],
          ["line", 1490, 540, 3, 48],
          ["arc", 1655, 480, 1830, 560, 60, 4],
          ["line", 1880, 620, 4, 48],
          ["arc", 2285, 560, 2460, 480, 70, 4],
          ["line", 2470, 540, 3, 48],
          ["arc", 2635, 480, 2810, 390, 70, 4],
          ["line", 2820, 450, 3, 48],
          ["arc", 2975, 390, 3150, 310, 70, 4],
          ["line", 3160, 370, 3, 48],
          ["arc", 3150, 300, 3300, 300, 20, 4],
          ["arc", 3315, 310, 3490, 400, 60, 4],
          ["line", 3500, 460, 3, 48],
          ["arc", 3675, 400, 3850, 550, 60, 4],
          ["line", 3880, 610, 3, 48],
          ["arc", 4475, 550, 4650, 460, 70, 4],
          ["line", 4660, 520, 3, 48],
          ["arc", 4825, 460, 5000, 370, 70, 4],
          ["line", 5100, 430, 3, 48],
          ["arc", 5235, 370, 5410, 460, 60, 4],
          ["line", 5420, 520, 3, 48],
          ["arc", 5575, 460, 5750, 540, 60, 4],
          ["line", 5760, 600, 4, 48],
          ["arc", 6015, 540, 6180, 460, 70, 4],
          ["arc", 6315, 460, 6460, 565, 50, 3]
        ],
        enemies: [
          [2100, 620, 1960, 2280, 90],
          [4000, 610, 3960, 4200, 92],
          [4300, 610, 4250, 4470, 95],
          [5130, 430, 5090, 5235, 70]
        ]
      }
    ]
  };

  root.MAVI_LEVEL_DATA = data;
})(typeof window !== "undefined" ? window : globalThis);
