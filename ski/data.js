// 上山 First Chair: the resorts, the drive to each, and the packing list a visitor starts with.
// Every text is a pair [Chinese, English].
//
// A resort has three places the weather is fetched for: `base`, the main base area; `top`, the upper
// mountain at about the height most of the skiing is done, which is not always the summit; and the
// highest point of the drive from the Bay Area, `pass`, or for someone staying near the mountain, the
// town they would stay in, `town`. Each is [lat, lon, metres above sea level]; the weather model is
// corrected to that height.
//
// A drive is a list of legs. A leg is a stretch of one highway, drawn as points along it in the order
// it is driven, most of them Caltrans' own chain control checkpoints and cameras on it. A checkpoint,
// camera, lane closure or CHP incident is on a leg if it is on the same highway within NEAR_KM of the
// line through those points. Legs marked `far` are driven only from the Bay Area; staying in `town`,
// the drive is `near` instead. `counties` are the counties of a leg, by which Caltrans' road text is
// sorted, since it names each stretch by county: '(Placer Co)'. `d` is the Caltrans district.
//
// Links are the resorts' own pages, checked in November 2026.

export const NEAR_KM = 1.6;

const I80_HILLS = {
  route: 'I-80', d: 3, far: true, counties: ['Placer', 'Nevada'],
  name: ['I-80 · Auburn → Kingvale', 'I-80 · Auburn to Kingvale'],
  path: [[38.9001, -121.0771], [38.9405, -121.0420], [39.0037, -120.9933], [39.0957, -120.9494], [39.1744, -120.8589],
    [39.2005, -120.8134], [39.2143, -120.7774], [39.2356, -120.7538], [39.2552, -120.7329], [39.2736, -120.7174],
    [39.2922, -120.6818], [39.3168, -120.6145], [39.3280, -120.5721], [39.3116, -120.5472], [39.3051, -120.5281],
    [39.3142, -120.4461]],
};
// Kingvale over Donner Summit to Truckee; `to` cuts it at the exit a resort takes
const donner = (to, extra = {}) => ({
  route: 'I-80', d: 3, counties: ['Placer', 'Nevada'],
  name: ['I-80 · Donner 山口 → Truckee', 'I-80 · over Donner Summit to Truckee'],
  path: [[39.3142, -120.4461], [39.3265, -120.3897], [39.3346, -120.3556], [39.3390, -120.3477], [39.3362, -120.3150],
    [39.3310, -120.2894], [39.3308, -120.2854], [39.3236, -120.2191], [39.3229, -120.2074], [39.3379, -120.1683]].slice(0, to),
  ...extra,
});
const SR89 = (to) => ({
  route: 'SR-89', d: 3, counties: ['Placer', 'Nevada'],
  name: ['SR-89 · Truckee → 雪场', 'SR-89 · Truckee to the resort'],
  path: [[39.3229, -120.2074], [39.3152, -120.2040], [39.2900, -120.2068], [39.2600, -120.2040], [39.2330, -120.2010],
    [39.2047, -120.1992], [39.1872, -120.1949]].slice(0, to),
});
const SR267 = {
  route: 'SR-267', d: 3, counties: ['Nevada', 'Placer'],
  name: ['SR-267 · Truckee → Northstar', 'SR-267 · Truckee to Northstar'],
  path: [[39.3379, -120.1683], [39.3343, -120.1632], [39.3144, -120.1482], [39.3028, -120.1234], [39.2860, -120.1041]],
};
const US50_HILLS = {
  route: 'US-50', d: 3, far: true, counties: ['El Dorado'],
  name: ['US-50 · Placerville → Kyburz', 'US-50 · Placerville to Kyburz'],
  path: [[38.6958, -120.8845], [38.7110, -120.8392], [38.7284, -120.8079], [38.7306, -120.7618], [38.7369, -120.7122],
    [38.7345, -120.6762], [38.7484, -120.6181], [38.7560, -120.5919], [38.7607, -120.5306], [38.7741, -120.4707],
    [38.7687, -120.4466], [38.7646, -120.3357], [38.7654, -120.3209], [38.7806, -120.2438]],
};
const US50_SUMMIT = (to) => ({
  route: 'US-50', d: 3, far: true, counties: ['El Dorado'],
  name: ['US-50 · Kyburz → Echo 山口', 'US-50 · Kyburz to Echo Summit'],
  path: [[38.7806, -120.2438], [38.7901, -120.1962], [38.7951, -120.1484], [38.8112, -120.1243], [38.8191, -120.0759],
    [38.8132, -120.0293]].slice(0, to),
});
const US50_BASIN = (from, to, extra = {}) => ({
  route: 'US-50', d: 3, counties: ['El Dorado'],
  name: ['US-50 · Echo 山口 → South Lake Tahoe', 'US-50 · Echo Summit to South Lake Tahoe'],
  path: [[38.8191, -120.0759], [38.8132, -120.0293], [38.8452, -120.0308], [38.8509, -120.0230], [38.8582, -120.0118],
    [38.8850, -120.0010], [38.9133, -120.0046], [38.9330, -119.9800], [38.9486, -119.9572], [38.9583, -119.9417]].slice(from, to),
  ...extra,
});
const SR88_WEST = {
  route: 'SR-88', d: 10, far: true, counties: ['Amador', 'Alpine'],
  name: ['SR-88 · Jackson → Kirkwood', 'SR-88 · Jackson to Kirkwood'],
  path: [[38.3853, -120.6876], [38.4079, -120.6503], [38.4151, -120.6112], [38.4341, -120.5611], [38.4433, -120.5366],
    [38.4770, -120.5243], [38.5143, -120.4825], [38.5272, -120.4324], [38.5446, -120.3773], [38.5480, -120.3065],
    [38.5563, -120.2938], [38.5634, -120.2693], [38.6250, -120.2000], [38.6676, -120.1222], [38.6969, -120.1201],
    [38.7056, -120.1090], [38.7004, -120.0782], [38.7027, -120.0715]],
};
const LUTHER = {
  route: 'SR-89', d: 3, counties: ['El Dorado', 'Alpine'],
  name: ['SR-89 · Meyers → Luther 山口', 'SR-89 · Meyers over Luther Pass'],
  path: [[38.8509, -120.0230], [38.8127, -120.0150], [38.7980, -119.9800], [38.7879, -119.9397], [38.7759, -119.9253]],
};
const SR88_EAST = {
  route: 'SR-88', d: 10, counties: ['Alpine'],
  name: ['SR-88 · Picketts → Carson 山口 → Kirkwood', 'SR-88 · Picketts Junction over Carson Pass'],
  path: [[38.7759, -119.9253], [38.7400, -119.9450], [38.7136, -119.9552], [38.6950, -119.9900], [38.7065, -120.0430],
    [38.7027, -120.0715]],
};

const DONNER = { name: ['Donner 山口', 'Donner Summit'], at: [39.3390, -120.3477, 2201], note: ['I-80 最高处', 'the top of I-80'] };
const ECHO = { name: ['Echo 山口', 'Echo Summit'], at: [38.8132, -120.0293, 2264], note: ['US-50 最高处', 'the top of US-50'] };
const TRUCKEE = { name: ['Truckee', 'Truckee'], at: [39.3280, -120.1833, 1798], note: ['住处，出发前先看这里', 'where you stay'] };
const SOUTH_LAKE = { name: ['South Lake Tahoe', 'South Lake Tahoe'], at: [38.9399, -119.9772, 1905], note: ['住处，出发前先看这里', 'where you stay'] };

const PALISADES_CAMS = ["Palisades Base 6200'", "Scope 8200'", 'Siberia', 'Far East', 'Alpine Peak', 'Alpine Race', 'Alpine Chalet'];

export const RESORTS = [
  {
    id: 'palisades', name: ['Palisades Tahoe', 'Palisades Tahoe'], area: ['Olympic Valley 主山', 'Olympic Valley side'],
    base: { name: ['Palisades 山脚', 'Palisades base'], note: ['Olympic Valley 雪村', 'the Village at Olympic Valley'], at: [39.1969, -120.2353, 1890] },
    top: { name: ['Palisades 山上', 'Palisades up top'], note: ['High Camp 一带，缆车上半程', 'around High Camp, the upper lifts'], at: [39.1840, -120.2610, 2500] },
    pass: DONNER, town: TRUCKEE,
    far: [I80_HILLS, donner(9), SR89(6)], near: [SR89(6)],
    links: {
      cams: 'https://www.palisadestahoe.com/mountain-information/webcams', camNames: PALISADES_CAMS,
      report: 'https://www.palisadestahoe.com/mountain-information/mountain-report',
      live: { name: 'KT-22', url: 'https://hdontap.com/stream/762258/palisades-tahoe-kt-22-live-webcam/',
        note: ['Palisades 最经典的那条缆车，HDOnTap 的直播，看山上在不在下雪', 'the classic chair at Palisades, streamed live by HDOnTap: see whether it is snowing up there'] },
    },
  },
  {
    id: 'alpine', name: ['Palisades Tahoe · Alpine', 'Palisades Tahoe · Alpine'], area: ['Alpine Meadows 那边', 'Alpine Meadows side'],
    base: { name: ['Alpine 山脚', 'Alpine base'], note: ['Alpine Lodge', 'Alpine Lodge'], at: [39.1645, -120.2386, 2083] },
    top: { name: ['Alpine 山上', 'Alpine up top'], note: ['Summit 缆车一带', 'around the Summit chair'], at: [39.1560, -120.2480, 2500] },
    pass: DONNER, town: TRUCKEE,
    far: [I80_HILLS, donner(9), SR89(7)], near: [SR89(7)],
    links: {
      cams: 'https://www.palisadestahoe.com/mountain-information/webcams', camNames: PALISADES_CAMS,
      report: 'https://www.palisadestahoe.com/mountain-information/mountain-report',
      live: { name: 'KT-22', url: 'https://hdontap.com/stream/762258/palisades-tahoe-kt-22-live-webcam/',
        note: ['隔壁 Olympic Valley 的 KT-22 直播，看山上在不在下雪', 'KT-22 next door at Olympic Valley, streamed live: see whether it is snowing'] },
    },
  },
  {
    id: 'northstar', name: ['Northstar', 'Northstar'], area: ['Truckee 南边', 'south of Truckee'],
    base: { name: ['Northstar 雪村', 'Northstar Village'], note: ['山脚', 'the base'], at: [39.2746, -120.1211, 1929] },
    top: { name: ['Northstar 山上', 'Northstar up top'], note: ['Mt. Pluto 一带', 'around Mt. Pluto'], at: [39.2622, -120.1349, 2500] },
    pass: DONNER, town: TRUCKEE,
    far: [I80_HILLS, donner(10), SR267], near: [SR267],
    links: {
      cams: 'https://www.northstarcalifornia.com/the-mountain/mountain-conditions/mountain-cams.aspx',
      report: 'https://www.northstarcalifornia.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    },
  },
  {
    id: 'sugarbowl', name: ['Sugar Bowl', 'Sugar Bowl'], area: ['Donner 山口', 'Donner Summit'],
    base: { name: ['Sugar Bowl 山脚', 'Sugar Bowl base'], note: ['Village 一带', 'around the Village'], at: [39.3045, -120.3346, 2098] },
    top: { name: ['Sugar Bowl 山上', 'Sugar Bowl up top'], note: ['Mt. Lincoln 一带', 'around Mt. Lincoln'], at: [39.2873, -120.3270, 2450] },
    pass: DONNER, town: TRUCKEE,
    far: [I80_HILLS, donner(2)],
    near: [{ ...donner(9), name: ['I-80 · Truckee → Donner 山口 → Soda Springs', 'I-80 · Truckee over Donner Summit'], path: donner(9).path.slice(1).reverse() }],
    links: { cams: 'https://www.sugarbowl.com/webcams', report: 'https://www.sugarbowl.com/conditions' },
  },
  {
    id: 'heavenly', name: ['Heavenly', 'Heavenly'], area: ['South Lake Tahoe', 'South Lake Tahoe'],
    base: { name: ['Heavenly 山脚', 'Heavenly base'], note: ['California Lodge', 'California Lodge'], at: [38.9358, -119.9457, 2001] },
    top: { name: ['Heavenly 山上', 'Heavenly up top'], note: ['Sky Deck 以上', 'above Sky Deck'], at: [38.9218, -119.9124, 2750] },
    pass: ECHO, town: SOUTH_LAKE,
    far: [US50_HILLS, US50_SUMMIT(6), US50_BASIN(1, 9)],
    near: [US50_BASIN(6, 9, { name: ['US-50 · South Lake Tahoe 城里', 'US-50 · through South Lake Tahoe'] })],
    links: {
      cams: 'https://www.skiheavenly.com/the-mountain/mountain-conditions/mountain-cams.aspx',
      report: 'https://www.skiheavenly.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    },
  },
  {
    id: 'sierra', name: ['Sierra-at-Tahoe', 'Sierra-at-Tahoe'], area: ['Echo 山口西边', 'west of Echo Summit'],
    base: { name: ['Sierra 山脚', 'Sierra base'], note: ['Base Lodge', 'the base lodge'], at: [38.8001, -120.0807, 2024] },
    top: { name: ['Sierra 山上', 'Sierra up top'], note: ['Huckleberry 一带', 'around Huckleberry'], at: [38.7890, -120.0675, 2550] },
    pass: ECHO, town: SOUTH_LAKE,
    far: [US50_HILLS, US50_SUMMIT(5)],
    near: [{ ...US50_BASIN(0, 7), name: ['US-50 · South Lake Tahoe → Echo 山口 → 雪场', 'US-50 · South Lake Tahoe over Echo Summit'], path: US50_BASIN(0, 7).path.slice().reverse() }],
    links: { cams: 'https://sierraattahoe.com/live-cams/', report: 'https://sierraattahoe.com/weather-snow-report/' },
  },
  {
    id: 'kirkwood', name: ['Kirkwood', 'Kirkwood'], area: ['Carson 山口', 'Carson Pass'],
    base: { name: ['Kirkwood 山脚', 'Kirkwood base'], note: ['Timber Creek 一带', 'around Timber Creek'], at: [38.6848, -120.0650, 2377] },
    top: { name: ['Kirkwood 山上', 'Kirkwood up top'], note: ['缆车上半程', 'the upper lifts'], at: [38.6700, -120.0765, 2850] },
    pass: { name: ['Carson Spur', 'Carson Spur'], at: [38.7056, -120.1090, 2430], note: ['SR-88 雪场前最高处', 'the top of SR-88 before the resort'] },
    town: SOUTH_LAKE,
    far: [SR88_WEST],
    near: [US50_BASIN(3, 7, { name: ['US-50 · South Lake Tahoe → Meyers', 'US-50 · South Lake Tahoe to Meyers'], path: US50_BASIN(3, 7).path.slice().reverse() }), LUTHER, SR88_EAST],
    links: {
      cams: 'https://www.kirkwood.com/the-mountain/mountain-conditions/mountain-cams.aspx',
      report: 'https://www.kirkwood.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    },
  },
];

// The packing list a new visitor starts with. `where` is where the thing is kept: 'home', 'car' or
// 'there' (at the cabin or in a locker by the mountain); the list can be changed, and is kept in the
// browser. Kids' things show only with Kids switched on.
export const PACKING = [
  { group: 'all', items: [
    [['雪板 / 雪鞋 / 固定器', 'Skis or boards, boots, bindings']],
    [['头盔 + 雪镜', 'Helmets and goggles']],
    [['雪镜备用低光镜片', 'A spare low-light goggle lens']],
    [['雪票 / 季卡（Ikon、Epic）', 'Lift tickets or passes (Ikon, Epic)']],
    [['暖宝宝 + 脚趾暖包', 'Hand and toe warmers']],
    [['防晒霜 + 唇膏', 'Sunscreen and lip balm']],
    [['保温杯，装热水', 'A thermos of something hot']],
    [['零食和水', 'Snacks and water']],
  ] },
  { group: 'adults', items: [
    [['美利奴打底', 'Merino base layers']],
    [['抓绒或羽绒中间层', 'A fleece or down mid layer']],
    [['雪服上衣 + 雪裤', 'Shell jacket and pants']],
    [['雪袜 ×2', 'Ski socks ×2']],
    [['手套，再备一副', 'Gloves, and a spare pair']],
    [['面罩或围脖', 'A balaclava or neck gaiter']],
  ] },
  { group: 'kids', items: [
    [['连指手套 ×2', 'Mittens ×2']],
    [['孩子的雪袜 ×2', "Kids' ski socks ×2"]],
    [['孩子的头盔 + 雪镜', "Kids' helmets and goggles"]],
    [['一整套换洗衣服', 'A full change of clothes']],
    [['小零食', 'Little snacks']],
  ] },
  { group: 'car', items: [
    [['链条（放后备箱上面，别埋在行李底下）', 'Chains (on top in the trunk, not under the bags)'], 'car'],
    [['雪铲 + 冰雪刷', 'A snow shovel and an ice scraper'], 'car'],
    [['防冻玻璃水', 'Winter washer fluid'], 'car'],
    [['回程换的干衣服', 'Dry clothes for the drive home']],
    [['手机充电线', 'A phone charger'], 'car'],
    [['毯子和水（封路堵在路上时用）', 'A blanket and water, for a long wait in a closure'], 'car'],
  ] },
];
