/* Everything 风土 Terroir (terroir/index.html) says, in Chinese and English: how each style of wine
   is made, the grapes, and the regions on the map. Every text is a pair, [Chinese, English].

   - styles: one per style of wine, with its steps in order; a style made in more than one way
     has variants, each with its own steps. `where` lists regions that make it.
   - grapes: `c` is red or white. `s` rates the typical wine from 1 (low) to 5 (high): body,
     acidity, and tannin for reds or aromatic intensity for whites. These are the textbook style,
     not every bottle. A grape's regions come from the regions that list it.
   - regions: `view` is the map view it belongs to; lat and lon place its dot. `glass` is the
     colour of the wine it is best known for (red, white, rose, amber), two for a region famous
     for both; `fizz` marks sparkling. `grapes` names grapes by id, or as [Chinese, English] for
     one without a card. `spots` are the villages and sub-regions shown when the map zooms in:
     [Chinese, English, lat, lon], with a fifth value 1 for a town shown only to find the way.
     Coordinates of spots were checked against OpenStreetMap (Nominatim), November 2026.

   After moving a region to another view, adding one far from its view's frame, or adding a
   view, run terroir/tools/build-map.mjs to redraw the maps. */
window.TerroirData = {

countries: {
  FR: ['法国', 'France'], IT: ['意大利', 'Italy'], ES: ['西班牙', 'Spain'], PT: ['葡萄牙', 'Portugal'],
  DE: ['德国', 'Germany'], AT: ['奥地利', 'Austria'], HU: ['匈牙利', 'Hungary'], GR: ['希腊', 'Greece'],
  GE: ['格鲁吉亚', 'Georgia'], US: ['美国', 'United States'], CA: ['加拿大', 'Canada'], CL: ['智利', 'Chile'],
  AR: ['阿根廷', 'Argentina'], ZA: ['南非', 'South Africa'], AU: ['澳大利亚', 'Australia'],
  NZ: ['新西兰', 'New Zealand'], CN: ['中国', 'China']
},

views: [
  { id: 'world', name: ['世界', 'World'] },
  { id: 'europe', name: ['欧洲', 'Europe'] },
  { id: 'france', name: ['法国', 'France'] },
  { id: 'italy', name: ['意大利', 'Italy'] },
  { id: 'iberia', name: ['西班牙与葡萄牙', 'Spain & Portugal'] },
  { id: 'central', name: ['德国、奥地利、匈牙利', 'Germany, Austria, Hungary'] },
  { id: 'california', name: ['加州', 'California'] },
  { id: 'pnw', name: ['俄勒冈与华盛顿', 'Oregon & Washington'] },
  { id: 'nyon', name: ['纽约与安大略', 'New York & Ontario'] },
  { id: 'southam', name: ['智利与阿根廷', 'Chile & Argentina'] },
  { id: 'cape', name: ['南非', 'South Africa'] },
  { id: 'oceania', name: ['澳大利亚与新西兰', 'Australia & New Zealand'] },
  { id: 'china', name: ['中国', 'China'] }
],

// Cities shown on the views to find the way: [Chinese, English, lat, lon]
cities: [
  ['巴黎', 'Paris', 48.857, 2.352], ['伦敦', 'London', 51.507, -0.128], ['罗马', 'Rome', 41.903, 12.496],
  ['米兰', 'Milan', 45.464, 9.190], ['马德里', 'Madrid', 40.417, -3.704], ['里斯本', 'Lisbon', 38.722, -9.139],
  ['波尔图', 'Porto', 41.150, -8.611], ['法兰克福', 'Frankfurt', 50.110, 8.682], ['慕尼黑', 'Munich', 48.137, 11.575],
  ['维也纳', 'Vienna', 48.208, 16.373], ['布达佩斯', 'Budapest', 47.498, 19.040], ['布拉格', 'Prague', 50.075, 14.438],
  ['雅典', 'Athens', 37.984, 23.728], ['伊斯坦布尔', 'Istanbul', 41.008, 28.978], ['第比利斯', 'Tbilisi', 41.716, 44.783],
  ['旧金山', 'San Francisco', 37.775, -122.419], ['洛杉矶', 'Los Angeles', 34.052, -118.244],
  ['波特兰', 'Portland', 45.515, -122.679], ['西雅图', 'Seattle', 47.606, -122.332], ['纽约', 'New York', 40.713, -74.006],
  ['多伦多', 'Toronto', 43.653, -79.383], ['圣地亚哥', 'Santiago', -33.449, -70.669],
  ['开普敦', 'Cape Town', -33.925, 18.424], ['悉尼', 'Sydney', -33.869, 151.209], ['墨尔本', 'Melbourne', -37.814, 144.963],
  ['阿德莱德', 'Adelaide', -34.929, 138.601], ['珀斯', 'Perth', -31.953, 115.861], ['奥克兰', 'Auckland', -36.849, 174.763],
  ['惠灵顿', 'Wellington', -41.287, 174.776], ['北京', 'Beijing', 39.904, 116.407], ['上海', 'Shanghai', 31.230, 121.474],
  ['乌鲁木齐', 'Ürümqi', 43.825, 87.617], ['昆明', 'Kunming', 25.038, 102.718]
],

/* ---------------------------------------------------------------- 酿造 How wine is made */
styles: [
  {
    id: 'red', glass: 'red', name: ['红葡萄酒', 'Red wine'],
    lead: [
      '红葡萄酒的颜色、单宁和大部分风味都在果皮里。葡萄破碎后连皮带汁一起发酵，再泡上几天到几周，颜色和单宁才进到酒里；红葡萄的汁本身几乎是无色的。',
      'A red wine’s colour, its tannin and most of its flavour are in the skins. The crushed grapes ferment with them and stay on them for days or weeks, and that is how colour and tannin get into the wine; the juice of red grapes is almost colourless.'
    ],
    where: ['bordeaux', 'burgundy', 'rhone-north', 'piedmont', 'rioja', 'napa', 'barossa', 'mendoza', 'ningxia'],
    variants: [
      {
        name: ['传统酿法', 'The usual way'],
        steps: [
          { t: ['采收', 'Harvest'], k: ['糖度约 22–26 °Brix', 'Sugar about 22–26 °Brix'],
            d: ['按糖、酸以及果皮和种子的成熟度定采收日期。手工采收可以在田间挑掉坏果，机器采收更快、更便宜。',
                'The picking date is set by sugar, acidity and how ripe the skins and seeds are. Pickers by hand can leave bad bunches behind; machines are faster and cheaper.'] },
          { t: ['除梗、破碎', 'Destemming and crushing'],
            d: ['去掉果梗，把果粒轻轻压破，让汁流出来接触酵母。也有酿酒师保留一部分整串连梗发酵，换来更多香气和结构。',
                'The stems come off and the berries are split so the juice meets the yeast. Some winemakers keep part of the bunches whole, stems and all, for lift and structure.'] },
          { t: ['酒精发酵', 'Fermentation'], k: ['25–30 °C · 5–14 天', '25–30 °C · 5–14 days'],
            d: ['酵母把糖变成酒精和二氧化碳，同时放热。红酒发酵温度较高，利于萃取颜色和单宁。可以靠果皮上的野生酵母，也可以接种选育的酵母。',
                'Yeast turns sugar into alcohol and carbon dioxide, giving off heat. Reds ferment warm, which draws out colour and tannin. The yeast can be the wild yeast on the skins or a cultured strain.'] },
          { t: ['淋皮、压帽', 'Pumping over, punching down'],
            d: ['二氧化碳把果皮推上液面，结成厚厚一层“酒帽”。每天把下面的酒液抽上来淋在帽上（remontage），或把帽压下去（pigeage），让皮和酒保持接触。',
                'Carbon dioxide pushes the skins up into a thick cap. Each day the juice is pumped over it (remontage) or the cap is punched down (pigeage), to keep skins and wine in touch.'] },
          { t: ['浸渍', 'Maceration'], k: ['带皮共 1–4 周', '1–4 weeks on skins in all'],
            d: ['发酵完后，很多酒继续带皮浸泡一到几周，单宁更多、也更圆润。带皮时间的长短，是酿酒师调整结构的主要手段。',
                'After fermentation many wines stay on the skins for another week or more, for more tannin and rounder tannin. Time on skins is the winemaker’s main lever on structure.'] },
          { t: ['压榨', 'Pressing'],
            d: ['先放出的酒叫自流酒，最柔顺；再把皮渣压榨，得到颜色更深、单宁更重的压榨酒，按需要调回一部分。',
                'The wine that runs off first, the free-run, is the softest. Pressing the skins gives press wine, darker and more tannic, and some of it is blended back.'] },
          { t: ['苹果酸-乳酸发酵', 'Malolactic conversion'],
            d: ['乳酸菌把尖锐的苹果酸转化为柔和的乳酸，酒更圆润，也更稳定。几乎所有红葡萄酒都经过这一步。',
                'Lactic bacteria turn sharp malic acid into softer lactic acid, rounding the wine and making it stable. Nearly every red goes through it.'] },
          { t: ['陈酿', 'Ageing'], k: ['波尔多桶 225 升 · 勃艮第桶 228 升', 'Bordeaux barrique 225 L · Burgundy pièce 228 L'],
            d: ['在橡木桶里放几个月到两三年：新桶带来香草、烤面包和雪松的气息，透过木头的微量氧气让单宁变柔。不锈钢罐、水泥罐和陶罐则更多保留果味。',
                'Months to two or three years in oak: new barrels add vanilla, toast and cedar, and the little oxygen that seeps through the wood softens the tannin. Steel, concrete and clay keep the fruit to the fore.'] },
          { t: ['调配', 'Blending'],
            d: ['把不同品种、地块和桶的酒按比例混合。波尔多酒几乎都是赤霞珠、梅洛等品种的调配；勃艮第红酒只用黑皮诺，调配的是不同的桶。',
                'Wines from different grapes, plots and barrels are married. Almost every Bordeaux is a blend of Cabernet, Merlot and others; red Burgundy is Pinot Noir alone, blended across barrels.'] },
          { t: ['澄清、过滤、装瓶', 'Fining, filtering, bottling'],
            d: ['用蛋清、膨润土等下胶剂让悬浮物沉淀，或过滤；也有酒庄两样都不做，以保留风味。装瓶前加少量二氧化硫，防止氧化。',
                'Egg white, bentonite and other fining agents settle out haze, or the wine is filtered; some estates do neither, to keep flavour. A little sulphur dioxide goes in before bottling, against oxygen.'] },
          { t: ['瓶中陈年', 'Bottle age'],
            d: ['好的红酒在瓶中继续变化：单宁慢慢沉淀成酒渣，新鲜果香转向皮革、林地和菌菇这些“陈年香气”。',
                'Good reds keep changing in bottle: tannin slowly drops out as sediment, and fresh fruit gives way to leather, forest floor and mushroom, the scents of age.'] }
        ]
      },
      {
        name: ['二氧化碳浸渍', 'Carbonic maceration'], where: ['beaujolais'],
        steps: [
          { t: ['整串入罐', 'Whole bunches in'],
            d: ['不破碎，整串葡萄直接放进灌满二氧化碳的密封罐。', 'The bunches go in whole, uncrushed, into a sealed tank filled with carbon dioxide.'] },
          { t: ['果粒内发酵', 'Fermentation inside the berry'], k: ['约 1–2 周', 'About 1–2 weeks'],
            d: ['没有氧气，果粒里的酶自己开始把糖变成少量酒精，果皮的颜色向内渗进果肉，带出香蕉、泡泡糖和樱桃般的果香。',
                'Without oxygen, enzymes inside each berry start turning sugar into a little alcohol, colour seeps in from the skin, and the wine picks up notes of banana, bubblegum and cherry.'] },
          { t: ['压榨后完成发酵', 'Pressed, then finished'],
            d: ['果粒破裂后压榨，汁液由酵母继续发酵完。单宁很少，果味鲜活，适合年轻时喝。博若莱多用这种方法或它的改良版。',
                'The berries burst and are pressed, and yeast finishes the fermentation. The wine has little tannin and bright fruit, best young. Beaujolais uses this method or a version of it.'] }
        ]
      }
    ]
  },
  {
    id: 'white', glass: 'white', name: ['白葡萄酒', 'White wine'],
    lead: [
      '白葡萄酒在发酵前就把汁和皮分开，所以几乎不带单宁。它要的是新鲜的香气和酸度，关键在于隔绝氧气、保持低温。因为汁是无色的，白葡萄酒也可以用红葡萄酿，香槟的“黑中白”就是这样。',
      'For white wine the juice leaves the skins before it ferments, so there is almost no tannin. What it wants is fresh aroma and acidity, and the craft is keeping oxygen out and the temperature down. Since the juice has no colour, white wine can be made from red grapes too, as in a blanc de noirs Champagne.'
    ],
    where: ['chablis', 'mosel', 'loire', 'alsace', 'wachau', 'marlborough', 'rias-baixas', 'santorini'],
    steps: [
      { t: ['采收', 'Harvest'], k: ['糖度约 19–24 °Brix', 'Sugar about 19–24 °Brix'],
        d: ['常在清晨凉爽时采收，尽量让果粒完整，避免氧化。白葡萄通常比红葡萄早采几周，以保留酸度。',
            'Often picked in the cool of early morning, with the fruit kept whole to keep oxygen out. White grapes usually come in weeks before red ones, to keep their acidity.'] },
      { t: ['压榨', 'Pressing'],
        d: ['整串或除梗后轻柔压榨，只要汁。最先流出的汁最干净精致。有些酒会先让汁和皮接触几小时，多萃取一些香气。',
            'Whole bunches, or destemmed berries, are pressed gently for the juice alone, and the first juice out is the finest. Some wines sit on the skins for a few hours first, to take up more aroma.'] },
      { t: ['静置澄清', 'Settling'],
        d: ['把汁冷却静置一夜，让泥沙和果肉沉下去，再把上层清汁移出（débourbage）。清澈的汁才能发酵得干净。',
            'The juice is chilled and left overnight so the solids sink, then the clear juice is drawn off the top (débourbage). Clean juice ferments clean.'] },
      { t: ['低温发酵', 'Cool fermentation'], k: ['12–18 °C · 2–6 周', '12–18 °C · 2–6 weeks'],
        d: ['在不锈钢罐里慢慢发酵几周，保住花香和果香。霞多丽等也常在橡木桶里发酵，口感更圆润。',
            'A slow fermentation over weeks in stainless steel keeps the flower and fruit aromas. Chardonnay and some others often ferment in barrel instead, for a rounder wine.'] },
      { t: ['苹乳发酵（可选）', 'Malolactic (optional)'],
        d: ['做了会更圆润，带黄油、奶油香，典型如加州霞多丽；想保留清爽酸度的雷司令、长相思一般不做。',
            'With it the wine turns rounder, buttery and creamy, as classic California Chardonnay is; Riesling and Sauvignon Blanc usually skip it to keep their bite.'] },
      { t: ['带酒泥陈酿', 'Ageing on lees'],
        d: ['发酵完，死去的酵母沉在底部成为酒泥。让酒留在泥上、定期搅动（bâtonnage），会增加酒体，带来面包和坚果般的风味。卢瓦尔河的蜜思卡岱就以“带泥陈酿”（sur lie）著称。',
            'Spent yeast settles as lees. Leaving the wine on them and stirring now and then (bâtonnage) adds body and a bready, nutty flavour. Muscadet sur lie, on the Loire, is named for it.'] },
      { t: ['冷稳定', 'Cold stabilisation'],
        d: ['把酒降到接近 0 °C，让酒石酸盐提前结晶析出，免得装瓶后瓶底出现像碎玻璃一样的“酒石”（无害）。',
            'The wine is chilled close to 0 °C so tartrate crystals drop out now, not later in the bottle, where they look like (harmless) slivers of glass.'] },
      { t: ['过滤、装瓶', 'Filtering, bottling'],
        d: ['大多数白葡萄酒会过滤，装瓶前加少量二氧化硫。多数适合趁年轻喝，但顶级的雷司令、勃艮第白和猎人谷赛美蓉能陈年几十年。',
            'Most whites are filtered, with a little sulphur dioxide added before bottling. Most are best young, but the best Riesling, white Burgundy and Hunter Semillon age for decades.'] }
    ]
  },
  {
    id: 'rose', glass: 'rose', name: ['桃红葡萄酒', 'Rosé'],
    lead: [
      '桃红的颜色来自和红葡萄皮的短暂接触：几小时，而不是几天。在欧盟，没有产区标志（PDO/PGI）的静止酒不能用红酒和白酒兑成桃红，法定产区酒照各自的规定；起泡酒不受这条限制，所以桃红香槟大多是兑出来的。',
      'Rosé takes its colour from a short time on red skins: hours rather than days. In the EU, still wine without a PDO or PGI may not be made rosé by blending red and white (appellation wines follow their own rules); sparkling wine is exempt, which is why most rosé Champagne is blended.'
    ],
    where: ['provence', 'rhone-south', 'languedoc'],
    steps: [
      { t: ['直接压榨', 'Direct pressing'],
        d: ['红葡萄整串直接压榨，汁在流出的过程中从果皮带走一点颜色。颜色最浅，普罗旺斯式的淡粉色大多由此而来。',
            'Red grapes are pressed whole straight away, and the juice picks up a little colour from the skins on its way out. This gives the palest wines, the Provence shade.'] },
      { t: ['短时浸皮', 'Short maceration'], k: ['2–20 小时', '2–20 hours'],
        d: ['破碎后让汁和皮接触几个小时，再把汁放出来发酵。时间越长，颜色越深、果味越浓，如罗讷河谷的塔维勒（Tavel）。',
            'Crushed grapes sit with their juice for some hours before it is run off to ferment. The longer, the deeper the colour and the flavour, as in Tavel in the Rhône.'] },
      { t: ['放血法', 'Saignée'],
        d: ['酿红酒时从罐里“放”出一部分早期的粉色汁液另酿桃红，留下的红酒因此更浓。',
            'While red wine is being made, some early pink juice is bled from the tank and made as rosé, which also concentrates the red left behind.'] },
      { t: ['低温发酵', 'Cool fermentation'],
        d: ['之后像白葡萄酒一样低温发酵，保留新鲜的红色水果和花香。大多数桃红适合在一两年内喝掉。',
            'From then on it is made like a white, fermented cool to keep fresh red fruit and flowers. Most rosé is best within a year or two.'] }
    ]
  },
  {
    id: 'sparkling', glass: 'white', fizz: true, name: ['起泡酒', 'Sparkling wine'],
    lead: [
      '气泡就是发酵产生的二氧化碳，诀窍在于把它留在酒里。最精细的办法是让酒在自己的瓶子里再发酵一次，香槟就是这样做的。',
      'The bubbles are the carbon dioxide of fermentation; the trick is keeping it in the wine. The finest way is to have the wine ferment a second time in its own bottle, as Champagne does.'
    ],
    where: ['champagne', 'penedes', 'prosecco'],
    variants: [
      {
        name: ['传统法', 'Traditional method'], where: ['champagne', 'penedes'],
        steps: [
          { t: ['基酒', 'Base wine'], k: ['酒精约 11%', 'About 11% alcohol'],
            d: ['提早采收保留高酸，先酿成干型的静止酒。红葡萄也可以用，只要轻柔压榨，流出的汁就是白的。',
                'Grapes picked early for high acidity are made into still, dry wine. Red grapes work too: pressed gently, their juice runs white.'] },
          { t: ['调配', 'Assemblage'],
            d: ['把不同品种、村庄和年份的基酒调配在一起。无年份香槟靠存下来的陈年基酒，让每年的风格保持一致。',
                'Base wines from different grapes, villages and years are blended. Non-vintage Champagne keeps a house style from year to year with stored reserve wines.'] },
          { t: ['加糖加酵母装瓶', 'Tirage'], k: ['每升约 24 克糖', 'About 24 g of sugar a litre'],
            d: ['加入糖和酵母（tirage）后装瓶，先用皇冠盖封口。', 'Sugar and yeast (the liqueur de tirage) go in, and the wine is bottled under a crown cap.'] },
          { t: ['瓶中二次发酵', 'Second fermentation'], k: ['瓶压约 6 个大气压', 'About 6 atmospheres'],
            d: ['酵母在瓶中把糖发酵完，酒精升高约 1.3%；二氧化碳无处可去，溶进酒里。',
                'The yeast ferments the sugar in the bottle, adding about 1.3% alcohol; the carbon dioxide has nowhere to go and dissolves into the wine.'] },
          { t: ['带酒泥陈年', 'Ageing on lees'], k: ['香槟：无年份至少 15 个月，年份至少 3 年', 'Champagne: 15 months at least, 3 years for vintage'],
            d: ['死去的酵母在瓶中慢慢自溶，带来烤面包、奶油蛋卷般的香气，气泡也更细腻。',
                'The dead yeast slowly breaks down in the bottle, giving toast and brioche and finer bubbles.'] },
          { t: ['转瓶', 'Riddling'],
            d: ['瓶子倒插在架上，几周里每天转一点、慢慢竖直，让酒泥滑到瓶口。如今多由机器（gyropalette）完成。',
                'Bottles are tilted neck down in racks and turned a little each day for weeks until the lees slide into the neck. Machines (gyropalettes) do most of it now.'] },
          { t: ['除渣', 'Disgorging'],
            d: ['瓶颈浸入冷冻液，酒泥冻成冰塞；一打开瓶盖，瓶内压力就把冰塞推出去。',
                'The neck is frozen in brine, trapping the lees in a plug of ice; when the cap comes off, the pressure shoots it out.'] },
          { t: ['补液、封塞', 'Dosage, corking'], k: ['Brut：每升少于 12 克糖', 'Brut: under 12 g of sugar a litre'],
            d: ['用葡萄酒和糖调成的补液把瓶子补满，它决定了甜度：Brut Nature 几乎不加，往上是 Extra Brut、Brut、Extra Dry、Sec、Demi-Sec。最后加软木塞和铁丝笼。',
                'The bottle is topped up with wine and sugar, which sets the sweetness: Brut Nature has next to none, then Extra Brut, Brut, Extra Dry, Sec and Demi-Sec. Then the cork and its wire cage go on.'] }
        ]
      },
      {
        name: ['罐式法', 'Tank method'], where: ['prosecco'],
        steps: [
          { t: ['基酒', 'Base wine'],
            d: ['和传统法一样，先酿成干型基酒。', 'As in the traditional method, a dry base wine comes first.'] },
          { t: ['罐中二次发酵', 'Second fermentation in tank'], k: ['几周', 'A few weeks'],
            d: ['把基酒和糖、酵母放进密封的不锈钢压力罐，在罐里完成二次发酵。',
                'The base wine goes into a sealed stainless-steel pressure tank with sugar and yeast, and ferments again there.'] },
          { t: ['过滤后加压装瓶', 'Filtered and bottled under pressure'],
            d: ['过滤掉酵母，在压力下装瓶。没有长时间的酒泥接触，保留了葡萄本身的花果香，也便宜得多。普洛赛克是代表。',
                'The wine is filtered off the yeast and bottled under pressure. With little time on lees it keeps the grape’s own fruit and flowers, and costs far less. Prosecco is the classic.'] }
        ]
      },
      {
        name: ['祖传法', 'Ancestral method'],
        steps: [
          { t: ['发酵到一半装瓶', 'Bottled mid-ferment'],
            d: ['第一次发酵还没结束就装瓶，剩下的糖在瓶中继续发酵，产生气泡。', 'The wine is bottled before its first fermentation is over, and the sugar left ferments on in the bottle, making the bubbles.'] },
          { t: ['通常不除渣', 'Often left cloudy'],
            d: ['很多酒不除渣，略带浑浊，气泡较柔和。如今流行的“自然起泡”（Pét-Nat）就是这种做法。',
                'Many are never disgorged, so they are a little cloudy, with gentler bubbles. Today’s fashionable pét-nat is made this way.'] }
        ]
      }
    ]
  },
  {
    id: 'sweet', glass: 'amber', name: ['甜酒', 'Sweet wine'],
    lead: [
      '酒的甜味来自没被发酵掉的糖。要么让葡萄里的糖浓缩到酵母吃不完，要么在糖还没发酵完时让发酵停下来。',
      'A wine’s sweetness is sugar the yeast did not ferment. Either the grapes are concentrated until there is more sugar than the yeast can finish, or the fermentation is stopped before it is done.'
    ],
    where: ['bordeaux', 'tokaj', 'niagara', 'mosel', 'constantia'],
    variants: [
      {
        name: ['贵腐', 'Noble rot'], where: ['bordeaux', 'tokaj', 'loire'],
        steps: [
          { t: ['贵腐菌', 'Botrytis'],
            d: ['在晨雾和午后阳光交替的地方，比如苏玳的锡龙河边、托卡伊的博德罗格河边，灰葡萄孢菌（Botrytis cinerea）刺穿果皮，水分蒸发，糖、酸和风味随之浓缩，还带来蜂蜜、杏干和藏红花般的香气。',
                'Where morning mists give way to sunny afternoons, by the Ciron at Sauternes or the Bodrog at Tokaj, the fungus Botrytis cinerea pierces the skins. Water evaporates and sugar, acid and flavour concentrate, with notes of honey, dried apricot and saffron.'] },
          { t: ['逐粒挑选', 'Picking berry by berry'],
            d: ['贵腐的进度不一，采摘工要在几周里多次穿过葡萄园，每次只摘已经干缩的果粒。产量极低，滴金酒庄常说一棵树只出一杯酒。',
                'The rot spreads unevenly, so pickers go through the vineyard several times over weeks, taking only the shrivelled berries. Yields are tiny; at Château d’Yquem, they say, a vine gives one glass.'] },
          { t: ['缓慢发酵', 'Slow fermentation'], k: ['苏玳：酒精约 13–14%，残糖每升 100 克以上', 'Sauternes: about 13–14%, over 100 g of sugar a litre'],
            d: ['糖分这么高的汁发酵很慢，有时持续几个月，在酵母停工时留下大量糖分。',
                'Juice this sweet ferments slowly, sometimes for months, and stops with a great deal of sugar left.'] },
          { t: ['托卡伊阿苏', 'Tokaji Aszú'], k: ['2013 年起每升至少 120 克糖', 'At least 120 g of sugar a litre since 2013'],
            d: ['托卡伊把贵腐果粒（aszú）捣成糊，浸进基酒或正在发酵的汁里萃取，再慢慢发酵、长期陈年。',
                'At Tokaj the botrytised berries (aszú) are mashed to a paste and steeped in base wine or fermenting juice, then fermented slowly and aged long.'] }
        ]
      },
      {
        name: ['冰酒', 'Ice wine'], where: ['niagara', 'mosel'],
        steps: [
          { t: ['在树上冻住', 'Frozen on the vine'], k: ['加拿大：采收时 −8 °C 或更冷', 'Canada: −8 °C or colder at picking'],
            d: ['葡萄一直留在树上到冬天，等气温降到零下八度以下冻成冰珠，常在夜里采摘。',
                'The grapes hang on into winter and are picked frozen, often at night, once it is −8 °C or colder.'] },
          { t: ['冻着压榨', 'Pressed frozen'],
            d: ['水分以冰的形式留在果里，只流出几滴糖浆般浓稠的汁，出汁量只有平时的一到两成。',
                'The water stays behind as ice and only a few drops of syrupy juice come out, a tenth to a fifth of the usual.'] },
          { t: ['发酵', 'Fermentation'], k: ['酒精约 8–13%', 'About 8–13% alcohol'],
            d: ['极甜的汁要发酵几周到几个月。冰酒酸度高，所以甜而不腻。',
                'The very sweet juice takes weeks or months to ferment. High acidity keeps ice wine from cloying.'] }
        ]
      },
      {
        name: ['风干葡萄', 'Dried grapes'], where: ['valpolicella', 'tuscany', 'sicily', 'santorini'],
        steps: [
          { t: ['采后风干', 'Drying'], k: ['失水 30%–50%', 'Losing 30–50% of their water'],
            d: ['葡萄采下后铺在草席、架子上或通风的房间里，风干几周到几个月。',
                'Picked grapes are laid on straw mats or racks, or hung in airy lofts, for weeks or months.'] },
          { t: ['发酵', 'Fermentation'],
            d: ['浓缩的汁可以酿成甜酒：威尼托的雷乔托（Recioto）、托斯卡纳的圣酒（Vin Santo）、西西里潘泰莱里亚的帕赛托（Passito）；也可以发酵到干：阿玛罗尼（Amarone）就是用风干葡萄酿的干红。',
                'The concentrated juice can be made sweet, as Recioto in the Veneto, Vin Santo in Tuscany and Passito di Pantelleria in Sicily, or fermented dry: Amarone is a dry red from dried grapes.'] }
        ]
      },
      {
        name: ['晚收与中止发酵', 'Late harvest, stopped fermentation'], where: ['alsace', 'mosel', 'piedmont'],
        steps: [
          { t: ['晚收', 'Late harvest'],
            d: ['让葡萄在树上多挂几周，糖分更高：德国的晚收（Spätlese）、精选（Auslese），阿尔萨斯的 Vendanges Tardives。',
                'Grapes left weeks longer on the vine get riper and sweeter: Spätlese and Auslese in Germany, Vendanges Tardives in Alsace.'] },
          { t: ['中止发酵', 'Stopping fermentation'], k: ['莫斯卡托阿斯蒂：约 5.5% 酒精', 'Moscato d’Asti: about 5.5% alcohol'],
            d: ['在糖还没发酵完时降温、滤掉酵母，留下天然的甜味和较低的酒精，莫斯卡托阿斯蒂就是这样，还微微起泡。加烈酒是另一种中止办法，见“加强酒”。',
                'Chilling the wine and filtering out the yeast before the sugar is gone leaves natural sweetness and less alcohol, as in lightly sparkling Moscato d’Asti. Adding spirit is the other way to stop it: see fortified wine.'] }
        ]
      }
    ]
  },
  {
    id: 'fortified', glass: 'amber', name: ['加强酒', 'Fortified wine'],
    lead: [
      '加强酒是加了烈酒（一般是葡萄蒸馏酒）的葡萄酒。发酵中途加，酵母停工，留下甜味，比如波特；发酵完再加，酒是干的，比如菲诺雪莉。',
      'A fortified wine has spirit, usually grape spirit, added. Added part-way through fermentation, it stops the yeast and leaves sweetness, as in Port; added afterwards, the wine stays dry, as in a Fino sherry.'
    ],
    where: ['douro', 'jerez', 'languedoc'],
    variants: [
      {
        name: ['波特', 'Port'], where: ['douro'],
        steps: [
          { t: ['快速萃取', 'Treading'], k: ['发酵只有 2–3 天', 'Only 2–3 days of fermentation'],
            d: ['发酵时间很短，颜色和单宁必须快速萃取出来。传统上在花岗岩石槽（lagar）里用脚踩，现在也有机械“脚”代劳。',
                'Fermentation is short, so colour and tannin must come out fast. Traditionally the grapes are trodden in granite troughs (lagares); mechanical feet do it too now.'] },
          { t: ['加烈', 'Fortification'], k: ['约 1 份烈酒兑 4 份酒', 'About 1 part spirit to 4 of wine'],
            d: ['大约一半的糖变成酒精时，加入 77% 的葡萄烈酒（aguardente），酵母停止工作，酒精升到约 19%–22%，留下每升约 100 克糖。',
                'When about half the sugar has turned to alcohol, 77% grape spirit (aguardente) goes in. The yeast stops, the alcohol rises to about 19–22%, and around 100 g of sugar a litre is left.'] },
          { t: ['陈年', 'Ageing'],
            d: ['宝石红波特（Ruby）在大桶里短期陈年，保留浓郁果味；茶色波特（Tawny）在小桶里氧化陈年多年，变成坚果和焦糖色；年份波特只在最好的年份宣布，可以在瓶中陈放几十年。传统上，酒在上游酿好，再运到河口加亚新城的酒窖陈年。',
                'Ruby Port spends a short time in big vats and keeps its fruit; Tawny ages for years in small casks and oxidises to nut and caramel; Vintage Port, declared only in the best years, ages for decades in bottle. Traditionally the wine was made upriver and aged in the lodges of Vila Nova de Gaia at the river’s mouth.'] }
        ]
      },
      {
        name: ['雪莉', 'Sherry'], where: ['jerez'],
        steps: [
          { t: ['干型基酒', 'Dry base wine'],
            d: ['帕洛米诺发酵成干型、中性的白葡萄酒，然后分级：最精致的做菲诺（Fino），较厚重的做奥罗露索（Oloroso）。',
                'Palomino ferments into a dry, neutral white wine, which is then sorted: the finest for Fino, the fuller for Oloroso.'] },
          { t: ['加烈', 'Fortification'], k: ['菲诺 15% · 奥罗露索 17%', 'Fino 15% · Oloroso 17%'],
            d: ['菲诺加烈到 15%，酵母还能活；奥罗露索加到 17%，酵母活不了。', 'Fino is fortified to 15%, where yeast can still live; Oloroso to 17%, where it cannot.'] },
          { t: ['酒花', 'Flor'],
            d: ['菲诺的桶不装满，酒面上长出一层白色的酵母膜“酒花”（flor），隔绝氧气，带来杏仁、面团和咸鲜的味道。没有酒花的奥罗露索则慢慢氧化，变成核桃和太妃糖色。',
                'Fino casks are left part-empty and a film of yeast, the flor, grows on the wine, shutting out oxygen and giving almond, dough and a salty tang. Oloroso, without flor, oxidises slowly to walnut and toffee.'] },
          { t: ['索莱拉', 'Solera'],
            d: ['桶分成好几层。装瓶时从最老的一层取酒，每次不超过三分之一，再用上一层补上，一层层往上补，新酒不断融进老酒，所以雪莉通常没有年份。最甜的佩德罗-希梅内斯（PX）用晒干的葡萄酿成。',
                'Casks stand in tiers. Wine for bottling is drawn from the oldest, never more than a third at a time, and topped up from the next tier, and so on up, so young wine keeps blending into old and sherry rarely has a vintage. The sweetest, Pedro Ximénez, is made from sun-dried grapes.'] }
        ]
      }
    ]
  },
  {
    id: 'orange', glass: 'amber', name: ['橙酒', 'Orange wine'],
    lead: [
      '用白葡萄、按红酒的方法带皮发酵，就得到琥珀色、带单宁的“橙酒”。这其实是最古老的酿法之一：格鲁吉亚人用陶罐酿酒已有大约八千年，带皮发酵正是那里的传统做法。',
      'White grapes fermented on their skins, the way red wine is made, give an amber, tannic “orange” wine. It is one of the oldest ways to make wine: Georgians have made wine in clay jars for some 8,000 years, and fermenting on the skins is their traditional way.'
    ],
    where: ['kakheti', 'friuli'],
    steps: [
      { t: ['带皮发酵', 'Fermenting on skins'],
        d: ['白葡萄破碎后连皮、有时连梗一起发酵，果皮里的单宁、酚类和颜色进入酒中。',
            'Crushed white grapes ferment with their skins, sometimes their stems too, and the skins give up tannin, phenolics and colour.'] },
      { t: ['陶罐', 'Qvevri'], k: ['带皮约 5–6 个月', 'About 5–6 months on skins'],
        d: ['格鲁吉亚的 qvevri 是埋在地下的蛋形陶罐，地温让发酵凉爽而平稳。发酵完封上口，酒和皮一起泡上大半年。2013 年这种酿法列入联合国教科文组织人类非物质文化遗产。',
            'Georgia’s qvevri are egg-shaped clay jars buried in the ground, which keeps fermentation cool and steady. When it is done they are sealed and the wine stays on its skins for half a year. UNESCO listed the method as intangible heritage in 2013.'] },
      { t: ['浸皮时间', 'How long on skins'], k: ['几天到几个月', 'Days to months'],
        d: ['浸皮越久，颜色越深、单宁越多，风味越偏向干果、茶和橙皮。1990 年代中后期，意大利弗留利与斯洛文尼亚边境的酒农让这种风格重新流行起来。',
            'The longer on skins, the deeper the colour, the more tannin, and the more the flavour turns to dried fruit, tea and orange peel. Growers on the Friuli–Slovenia border revived the style in the mid-to-late 1990s.'] },
      { t: ['少干预装瓶', 'Bottled with little intervention'],
        d: ['橙酒常常不澄清、不过滤，二氧化硫也用得很少，所以可能略带浑浊。饮用温度比白葡萄酒稍高，配菜时可以当红酒用。',
            'Orange wines are often bottled unfined and unfiltered, with little sulphur dioxide, so they can be hazy. Serve them a little warmer than white wine and treat them at the table like a red.'] }
    ]
  }
],

/* ---------------------------------------------------------------- 品种 Grapes */
grapes: [
  { id: 'cabernet-sauvignon', c: 'red', name: ['赤霞珠', 'Cabernet Sauvignon'], origin: ['法国波尔多', 'Bordeaux, France'],
    s: { body: 5, tannin: 5, acid: 4 },
    notes: [['黑醋栗', 'blackcurrant'], ['黑樱桃', 'black cherry'], ['雪松', 'cedar'], ['青椒', 'green pepper'], ['薄荷', 'mint'], ['烟草', 'tobacco']],
    text: ['世界上种植面积最大的酿酒葡萄。1997 年的 DNA 研究发现，它是品丽珠和长相思的后代。皮厚、晚熟，单宁和酸度都高，很适合橡木桶陈年，好酒能放几十年。波尔多左岸用它做调配的主角，纳帕谷则常用它单独酿成浓郁的红酒。',
           'The most planted wine grape in the world, and, DNA showed in 1997, a child of Cabernet Franc and Sauvignon Blanc. Thick-skinned and late to ripen, high in tannin and acidity, it takes well to oak, and the best last for decades. It leads the blends of Bordeaux’s Left Bank; in Napa it usually goes alone, ripe and dense.'],
    pair: ['烤牛排、羊排、硬质奶酪', 'Steak, lamb chops, hard cheese'] },
  { id: 'merlot', c: 'red', name: ['梅洛', 'Merlot'], origin: ['法国波尔多', 'Bordeaux, France'],
    s: { body: 4, tannin: 3, acid: 3 },
    notes: [['李子', 'plum'], ['黑樱桃', 'black cherry'], ['可可', 'cocoa'], ['月桂叶', 'bay leaf'], ['松露', 'truffle']],
    text: ['比赤霞珠早熟一到两周，单宁更柔、果味更圆，在较凉的黏土上也能成熟。它是波尔多右岸的主角，波美侯的柏图斯几乎全用梅洛。种植面积在全世界仅次于赤霞珠。',
           'It ripens a week or two before Cabernet, with softer tannin and rounder fruit, and ripens on cooler clay too. It rules Bordeaux’s Right Bank, where Pétrus in Pomerol is almost all Merlot, and only Cabernet Sauvignon is more widely planted.'],
    pair: ['烤鸭、红烧肉、菌菇', 'Roast duck, braised pork, mushrooms'] },
  { id: 'cabernet-franc', c: 'red', name: ['品丽珠', 'Cabernet Franc'], origin: ['法国西南部，可能源自西班牙巴斯克地区', 'South-west France, perhaps from the Spanish Basque Country'],
    s: { body: 3, tannin: 3, acid: 4 },
    notes: [['覆盆子', 'raspberry'], ['紫罗兰', 'violet'], ['青椒', 'green pepper'], ['铅笔芯', 'pencil shavings']],
    text: ['赤霞珠和梅洛的亲本之一，比两者都轻盈，带覆盆子、紫罗兰和一丝青椒的气息。在卢瓦尔河谷的希农和布尔格伊，它单独酿成清爽的红酒；圣埃美隆白马酒庄的葡萄园一半以上种的是它。山东烟台的品丽珠近年也很受关注。',
           'A parent of both Cabernet Sauvignon and Merlot, and lighter than either, with raspberry, violets and a hint of green pepper. In Chinon and Bourgueil on the Loire it makes fresh reds on its own; at Château Cheval Blanc in Saint-Émilion it fills more than half the vineyard. Yantai, in Shandong, has made a name with it lately.'],
    pair: ['烤鸡、猪肉、山羊奶酪', 'Roast chicken, pork, goat’s cheese'] },
  { id: 'pinot-noir', c: 'red', name: ['黑皮诺', 'Pinot Noir'], origin: ['法国勃艮第', 'Burgundy, France'],
    s: { body: 2, tannin: 2, acid: 4 },
    notes: [['樱桃', 'cherry'], ['草莓', 'strawberry'], ['玫瑰', 'rose'], ['蘑菇', 'mushroom'], ['林地', 'forest floor']],
    text: ['皮薄、早熟、难种，对气候和土壤极其敏感，所以最能体现风土：勃艮第相隔几百米的两块地，酒可能完全不同。颜色浅、单宁低、酸度高，年轻时是樱桃和草莓，陈年后转向蘑菇、林地和皮革。它也是香槟的主要品种之一。',
           'Thin-skinned, early and hard to grow, it is so sensitive to climate and soil that it shows terroir better than any other grape: in Burgundy, two plots a few hundred metres apart can make quite different wines. Pale, low in tannin and high in acidity, it is cherry and strawberry when young and turns to mushroom, forest floor and leather with age. It is also one of the main grapes of Champagne.'],
    pair: ['北京烤鸭、三文鱼、菌菇', 'Peking duck, salmon, mushrooms'] },
  { id: 'syrah', c: 'red', name: ['西拉', 'Syrah'], aka: ['设拉子', 'Shiraz'], origin: ['法国北罗讷', 'Northern Rhône, France'],
    s: { body: 5, tannin: 4, acid: 3 },
    notes: [['黑莓', 'blackberry'], ['黑胡椒', 'black pepper'], ['橄榄', 'olive'], ['紫罗兰', 'violet'], ['烟熏肉', 'smoked meat']],
    text: ['北罗讷的西拉（埃米塔日、罗蒂丘）偏凉爽，带黑胡椒、橄榄和紫罗兰的咸鲜气息。澳大利亚叫它设拉子，在巴罗萨这样的温暖产区更饱满，满是黑莓、巧克力和甘草；那里有 19 世纪中叶种下、至今仍在结果的老藤。',
           'In the Northern Rhône (Hermitage, Côte-Rôtie) it is cool and savoury, with black pepper, olive and violets. Australians call it Shiraz, and in warm places like the Barossa it is fuller, all blackberry, chocolate and liquorice; some Barossa vines planted in the mid-1800s still bear fruit.'],
    pair: ['烤羊肉、孜然羊肉、烧烤', 'Lamb, cumin lamb, barbecue'] },
  { id: 'grenache', c: 'red', name: ['歌海娜', 'Grenache'], aka: ['', 'Garnacha'], origin: ['西班牙阿拉贡', 'Aragón, Spain'],
    s: { body: 4, tannin: 2, acid: 2 },
    notes: [['草莓', 'strawberry'], ['覆盆子', 'raspberry'], ['白胡椒', 'white pepper'], ['甘草', 'liquorice'], ['干香草', 'dried herbs']],
    text: ['喜欢炎热干燥，耐旱，常以不搭架的灌木式种植。糖分高、酒精高，单宁和颜色较淡，带成熟的红色水果和干香草的气息。它是教皇新堡等南罗讷调配的主角，也是西班牙普里奥拉托的核心，还是很多普罗旺斯桃红的基础。',
           'It loves heat and drought and is often grown as free-standing bush vines. High in sugar and alcohol but light in tannin and colour, it tastes of ripe red fruit and dried herbs. It leads the blends of Châteauneuf-du-Pape and the Southern Rhône, is the heart of Priorat, and is the base of much Provence rosé.'],
    pair: ['烤肉、炖菜、地中海菜', 'Roasts, stews, Mediterranean food'] },
  { id: 'mourvedre', c: 'red', name: ['慕合怀特', 'Mourvèdre'], aka: ['', 'Monastrell, Mataro'], origin: ['西班牙', 'Spain'],
    s: { body: 5, tannin: 5, acid: 3 },
    notes: [['黑莓', 'blackberry'], ['野味', 'game'], ['皮革', 'leather'], ['黑胡椒', 'black pepper']],
    text: ['晚熟、需要大量阳光，酒农说它“要把脸晒在太阳下，把脚泡在水里”。单宁强，带野味和皮革气息，常给歌海娜-西拉-慕合怀特（GSM）调配增添结构。普罗旺斯邦多尔的红酒以它为主；在西班牙它叫 Monastrell，在澳大利亚叫 Mataro。',
           'Late to ripen and hungry for sun; growers say it wants its face in the sun and its feet in water. Tannic, with game and leather, it gives structure to GSM blends (Grenache, Syrah, Mourvèdre). It is the main grape of red Bandol in Provence; Spain calls it Monastrell and Australia Mataro.'],
    pair: ['炖牛肉、野味、烤羊', 'Beef stew, game, roast lamb'] },
  { id: 'tempranillo', c: 'red', name: ['丹魄', 'Tempranillo'], aka: ['', 'Tinto Fino, Tinta Roriz'], origin: ['西班牙北部', 'Northern Spain'],
    s: { body: 4, tannin: 4, acid: 3 },
    notes: [['樱桃', 'cherry'], ['李子', 'plum'], ['皮革', 'leather'], ['烟草', 'tobacco'], ['香草与椰子', 'vanilla and coconut'], ['莳萝', 'dill']],
    text: ['名字来自西班牙语 temprano（早），因为它比当地其他品种熟得早。里奥哈传统上用美国橡木桶长期陈年，带来香草、椰子和莳萝的香气；杜埃罗河岸的高原产区叫它 Tinto Fino，酒更浓更结实。在葡萄牙它叫 Tinta Roriz，是波特酒的品种之一。',
           'Its name comes from temprano, early, because it ripens before the other local grapes. Rioja traditionally ages it long in American oak, which brings vanilla, coconut and dill; up on the plateau of Ribera del Duero it is called Tinto Fino and makes denser, firmer wine. In Portugal, as Tinta Roriz, it goes into Port.'],
    pair: ['伊比利亚火腿、烤乳猪、羊排', 'Ibérico ham, roast suckling pig, lamb chops'] },
  { id: 'sangiovese', c: 'red', name: ['桑娇维塞', 'Sangiovese'], origin: ['意大利托斯卡纳', 'Tuscany, Italy'],
    s: { body: 3, tannin: 4, acid: 5 },
    notes: [['酸樱桃', 'sour cherry'], ['红李', 'red plum'], ['番茄叶', 'tomato leaf'], ['干香草', 'dried herbs'], ['皮革', 'leather']],
    text: ['意大利种植最广的红葡萄，名字据说来自拉丁语 sanguis Jovis，“朱庇特之血”。高酸、单宁紧实，带酸樱桃、番茄叶和干香草的味道，天生适合配以番茄为底的意大利菜。基安蒂经典、蒙塔奇诺布鲁奈罗（100% 桑娇维塞）和蒙特普尔恰诺贵族酒都以它为主。',
           'Italy’s most planted red grape; its name is said to come from the Latin sanguis Jovis, the blood of Jupiter. High acidity and firm tannin, with sour cherry, tomato leaf and dried herbs, make it a natural partner for Italian food built on tomatoes. It is the grape of Chianti Classico, Brunello di Montalcino (100% Sangiovese) and Vino Nobile di Montepulciano.'],
    pair: ['番茄意面、披萨、烤肉', 'Tomato pasta, pizza, grilled meat'] },
  { id: 'nebbiolo', c: 'red', name: ['内比奥罗', 'Nebbiolo'], origin: ['意大利皮埃蒙特', 'Piedmont, Italy'],
    s: { body: 4, tannin: 5, acid: 5 },
    notes: [['玫瑰', 'rose'], ['焦油', 'tar'], ['樱桃', 'cherry'], ['甘草', 'liquorice'], ['松露', 'truffle']],
    text: ['名字来自 nebbia（雾）：一说是因为它采收很晚，那时朗格山丘上常有秋雾；一说指果皮上那层雾一样的白色果粉。颜色浅，单宁却极强、酸度高，香气是有名的“焦油与玫瑰”。巴罗洛和巴巴莱斯科是它最好的酒，年轻时很涩，往往要陈年十年以上才见风采。',
           'Named for nebbia, fog: perhaps because it is picked so late that autumn mist lies over the Langhe hills, perhaps for the misty bloom on its berries. Pale yet fiercely tannic and acidic, it smells famously of tar and roses. Barolo and Barbaresco are its great wines, hard when young and often best after ten years or more.'],
    pair: ['松露菜、红酒炖牛肉、陈年奶酪', 'Truffles, braised beef, aged cheese'] },
  { id: 'barbera', c: 'red', name: ['巴贝拉', 'Barbera'], origin: ['意大利皮埃蒙特', 'Piedmont, Italy'],
    s: { body: 3, tannin: 2, acid: 5 },
    notes: [['酸樱桃', 'sour cherry'], ['黑莓', 'blackberry'], ['李子', 'plum']],
    text: ['皮埃蒙特的日常红酒：颜色深、单宁低、酸度很高，果味多汁，适合配餐。阿斯蒂巴贝拉和阿尔巴巴贝拉最有名。当地人留着内比奥罗去陈年，平时喝巴贝拉。',
           'Piedmont’s everyday red: deep in colour, low in tannin, very high in acidity, juicy and made for the table. Barbera d’Asti and Barbera d’Alba are the best known. Locals save Nebbiolo for the cellar and drink Barbera in the meantime.'],
    pair: ['意面、披萨、腌肉', 'Pasta, pizza, salumi'] },
  { id: 'corvina', c: 'red', name: ['科维纳', 'Corvina'], origin: ['意大利威尼托', 'Veneto, Italy'],
    s: { body: 2, tannin: 2, acid: 4 },
    notes: [['酸樱桃', 'sour cherry'], ['杏仁', 'almond'], ['葡萄干', 'raisin'], ['黑巧克力', 'dark chocolate']],
    text: ['瓦坡里切拉的主要品种，平常酿成酸爽、带樱桃味的轻盈红酒。最有名的是阿玛罗尼（Amarone）：葡萄采下后风干三四个月再发酵，酒精常在 15% 以上，带葡萄干和黑巧克力般的浓郁风味，却是干型的。',
           'The main grape of Valpolicella, usually a light, tangy red tasting of cherries. Its famous wine is Amarone: the grapes dry for three or four months before fermentation, and the wine, often over 15%, tastes of raisins and dark chocolate yet is dry.'],
    pair: ['炖肉、陈年帕玛森、烩饭', 'Stews, aged Parmigiano, risotto'] },
  { id: 'malbec', c: 'red', name: ['马尔贝克', 'Malbec'], origin: ['法国卡奥尔', 'Cahors, France'],
    s: { body: 4, tannin: 4, acid: 3 },
    notes: [['黑李', 'black plum'], ['黑莓', 'blackberry'], ['紫罗兰', 'violet'], ['可可', 'cocoa']],
    text: ['原产法国西南部的卡奥尔（Cahors），曾是波尔多的调配品种。19 世纪中叶来到阿根廷，在门多萨高海拔的强烈日照下大放异彩，酒色深紫、带黑李和紫罗兰香气，单宁柔和，如今是阿根廷的代表品种。',
           'From Cahors in south-west France, and once a Bordeaux blending grape. It reached Argentina in the mid-1800s and found its home in the strong sun of high-altitude Mendoza, making deep purple wines with black plum, violets and soft tannin. It is now Argentina’s signature grape.'],
    pair: ['阿根廷烤肉、牛排、烤串', 'Asado, steak, kebabs'] },
  { id: 'zinfandel', c: 'red', name: ['仙粉黛', 'Zinfandel'], aka: ['普里米蒂沃', 'Primitivo'], origin: ['克罗地亚', 'Croatia'],
    s: { body: 5, tannin: 3, acid: 3 },
    notes: [['黑莓果酱', 'blackberry jam'], ['覆盆子', 'raspberry'], ['黑胡椒', 'black pepper'], ['无花果干', 'dried fig']],
    text: ['加州的传家宝品种。DNA 研究证明它和意大利南部的普里米蒂沃是同一个品种，两者都源自克罗地亚。成熟不均匀，同一串上常常既有葡萄干又有青果，酒精很容易超过 15%，带果酱般浓郁的黑莓和香料味。加州有不少上百年的老藤。',
           'California’s heritage grape. DNA showed it is the same as southern Italy’s Primitivo, and that both come from Croatia. It ripens unevenly, with raisins and green berries on one bunch, easily passes 15% alcohol and tastes of jammy blackberry and spice. California has many vines over a century old.'],
    pair: ['烧烤、汉堡、微辣的菜', 'Barbecue, burgers, mildly spicy food'] },
  { id: 'gamay', c: 'red', name: ['佳美', 'Gamay'], origin: ['法国勃艮第', 'Burgundy, France'],
    s: { body: 1, tannin: 1, acid: 4 },
    notes: [['红樱桃', 'red cherry'], ['覆盆子', 'raspberry'], ['紫罗兰', 'violet'], ['香蕉', 'banana']],
    text: ['博若莱的葡萄。1395 年勃艮第公爵“大胆的菲利普”下令把它赶出勃艮第，为黑皮诺让路，它就在南边的花岗岩山丘上安了家。常用二氧化碳浸渍法酿造，清淡多汁、几乎没有单宁，适合稍微冰镇着喝。',
           'The grape of Beaujolais. In 1395 Philip the Bold, Duke of Burgundy, banished it from Burgundy to make room for Pinot Noir, and it settled on the granite hills to the south. Often made by carbonic maceration, it is light, juicy and nearly tannin-free, good slightly chilled.'],
    pair: ['冷切肉、烤鸡、轻辣的菜', 'Charcuterie, roast chicken, mildly spicy food'] },
  { id: 'carmenere', c: 'red', name: ['佳美娜', 'Carménère'], aka: ['蛇龙珠', 'Cabernet Gernischt'], origin: ['法国波尔多', 'Bordeaux, France'],
    s: { body: 4, tannin: 3, acid: 3 },
    notes: [['黑樱桃', 'black cherry'], ['青椒', 'green pepper'], ['黑胡椒', 'black pepper'], ['烟草', 'tobacco']],
    text: ['原是波尔多的老品种，根瘤蚜虫害之后在法国几乎绝迹。它早年混在“梅洛”插条里来到智利，被认错了一百多年，直到 1994 年才被鉴定出来，如今是智利的招牌。山东种了上百年的“蛇龙珠”，经 DNA 鉴定也是佳美娜。没熟透时青椒味很明显。',
           'An old Bordeaux grape that all but vanished from France after phylloxera. It reached Chile mixed in with cuttings sold as Merlot and went unrecognised for more than a century, until it was identified in 1994; it is now Chile’s signature. Shandong’s long-grown Cabernet Gernischt (蛇龙珠) has turned out, by DNA, to be Carménère too. Underripe, it tastes strongly of green pepper.'],
    pair: ['烤肉、墨西哥菜、烤蔬菜', 'Grilled meat, Mexican food, roast vegetables'] },
  { id: 'pinotage', c: 'red', name: ['皮诺塔吉', 'Pinotage'], origin: ['南非斯泰伦博斯，1925 年', 'Stellenbosch, South Africa, 1925'],
    s: { body: 4, tannin: 4, acid: 3 },
    notes: [['黑莓', 'blackberry'], ['李子', 'plum'], ['烟熏', 'smoke'], ['咖啡', 'coffee']],
    text: ['1925 年斯泰伦博斯大学的佩罗尔德教授（Abraham Perold）用黑皮诺和神索（当时南非叫它 Hermitage）杂交而成，名字也由两者拼成。带黑色水果和烟熏味；近年流行用重烘烤的橡木桶酿出带咖啡香的风格。它几乎只在南非种植。',
           'Bred in 1925 by Professor Abraham Perold at Stellenbosch University from Pinot Noir and Cinsault (then called Hermitage in South Africa), whose names it combines. It has dark fruit and smoke; a recent style uses heavily toasted oak for notes of coffee. It is grown almost only in South Africa.'],
    pair: ['南非烧烤、烟熏肉、炖菜', 'Braai, smoked meats, stews'] },
  { id: 'touriga-nacional', c: 'red', name: ['国产多瑞加', 'Touriga Nacional'], origin: ['葡萄牙', 'Portugal'],
    s: { body: 5, tannin: 5, acid: 4 },
    notes: [['黑莓', 'blackberry'], ['紫罗兰', 'violet'], ['佛手柑', 'bergamot'], ['甘草', 'liquorice']],
    text: ['葡萄牙最好的红葡萄：果粒小、产量低，颜色深、单宁浓，香气浓烈，带紫罗兰和佛手柑的花香。它是波特酒最重要的品种之一，如今也用来酿杜罗河谷的干红。',
           'Portugal’s finest red grape: small berries, low yields, deep colour, dense tannin and a heady scent of violets and bergamot. It is one of the most important grapes in Port, and now in the Douro’s dry reds too.'],
    pair: ['炖肉、烤羊；波特配巧克力和蓝纹奶酪', 'Stews, roast lamb; Port with chocolate and Stilton'] },
  { id: 'saperavi', c: 'red', name: ['萨别拉维', 'Saperavi'], origin: ['格鲁吉亚', 'Georgia'],
    s: { body: 5, tannin: 4, acid: 5 },
    notes: [['黑莓', 'blackberry'], ['黑樱桃', 'black cherry'], ['甘草', 'liquorice'], ['烟熏', 'smoke']],
    text: ['格鲁吉亚最重要的红葡萄，名字意为“染料”：它是少数果肉也是红色的葡萄，酒色深得几乎不透光。酸度高、单宁强、很耐陈，既可以在陶罐里酿，也可以用橡木桶。',
           'Georgia’s leading red grape. Its name means dye: it is one of the few grapes with red flesh as well as red skin, and its wine is nearly opaque. High in acidity and tannin, it ages well, whether made in qvevri or in oak.'],
    pair: ['格鲁吉亚烤肉串、炖羊肉', 'Georgian mtsvadi, lamb stew'] },
  { id: 'marselan', c: 'red', name: ['马瑟兰', 'Marselan'], origin: ['法国，1961 年育成', 'France, bred in 1961'],
    s: { body: 4, tannin: 4, acid: 3 },
    notes: [['黑樱桃', 'black cherry'], ['黑莓', 'blackberry'], ['薄荷', 'mint'], ['香料', 'spice']],
    text: ['1961 年法国国家农业研究院在马赛扬（Marseillan）用赤霞珠和歌海娜杂交育成，本想要大颗粒、高产，结果果粒很小，一度被冷落。2001 年前后它被引进中国，在宁夏、河北、新疆表现出色，酒色深、单宁细腻，带黑色浆果和香料，常被称作“中国的招牌品种”。',
           'Bred in 1961 by France’s national agricultural research institute at Marseillan, from Cabernet Sauvignon and Grenache. Meant to give big berries and big yields, it gave small ones and was long ignored. Brought to China around 2001, it has done well in Ningxia, Hebei and Xinjiang, with deep colour, fine tannin, dark fruit and spice, and is often called China’s signature grape.'],
    pair: ['红烧肉、烤羊肉、北京烤鸭', 'Braised pork, roast lamb, Peking duck'] },

  { id: 'chardonnay', c: 'white', name: ['霞多丽', 'Chardonnay'], origin: ['法国勃艮第', 'Burgundy, France'],
    s: { body: 4, acid: 3, aroma: 2 },
    notes: [['柠檬', 'lemon'], ['青苹果', 'green apple'], ['桃子', 'peach'], ['菠萝', 'pineapple'], ['黄油', 'butter'], ['榛子', 'hazelnut']],
    text: ['本身香气中性，像一张画布，风格取决于产地和酿法：夏布利冷凉、不过桶，带青苹果、柠檬和湿石头般的气息；默尔索和蒙哈榭在桶里发酵，饱满，带坚果和烤面包香；温暖的加州则是菠萝和黄油般浓郁。它也是香槟三大品种之一，“白中白”香槟只用霞多丽。',
           'Fairly neutral itself, a canvas for place and winemaking. Chablis, cool and unoaked, is green apple, lemon and wet stone; Meursault and Montrachet, fermented in barrel, are rich with hazelnut and toast; warm California makes it tropical and buttery. It is one of the three grapes of Champagne, and the only one in a blanc de blancs.'],
    pair: ['清蒸鱼、白灼虾、黄油龙虾、奶油鸡', 'Steamed fish, prawns, lobster, chicken in cream'] },
  { id: 'sauvignon-blanc', c: 'white', name: ['长相思', 'Sauvignon Blanc'], origin: ['法国卢瓦尔河谷或西南部', 'Loire or south-west France'],
    s: { body: 2, acid: 5, aroma: 5 },
    notes: [['青草', 'cut grass'], ['西柚', 'grapefruit'], ['百香果', 'passion fruit'], ['接骨木花', 'elderflower'], ['打火石', 'flint']],
    text: ['香气张扬、酸度高，大多不过桶，趁年轻喝。卢瓦尔河的桑塞尔和普伊-富美较克制，带青草、柠檬和打火石的气息；新西兰马尔堡则是热烈的百香果和西柚，在 1980 年代一举成名。在波尔多它和赛美蓉调配，既酿干白，也是苏玳甜酒的一部分。',
           'Aromatic and high in acidity, mostly unoaked and drunk young. Sancerre and Pouilly-Fumé on the Loire are restrained, with cut grass, lemon and flint; Marlborough, in New Zealand, is all passion fruit and grapefruit, and became famous for it in the 1980s. In Bordeaux it is blended with Sémillon, for dry whites and for sweet Sauternes.'],
    pair: ['山羊奶酪、生蚝、凉拌菜', 'Goat’s cheese, oysters, salads'] },
  { id: 'riesling', c: 'white', name: ['雷司令', 'Riesling'], origin: ['德国莱茵河流域', 'The Rhine, Germany'],
    s: { body: 2, acid: 5, aroma: 5 },
    notes: [['青柠', 'lime'], ['青苹果', 'green apple'], ['桃子', 'peach'], ['白花', 'white blossom'], ['蜂蜜', 'honey'], ['汽油', 'petrol']],
    text: ['酸度极高、香气纯净，从干型到极甜都能酿，而且能陈年几十年。德国摩泽尔的雷司令酒精常常只有 8% 左右，甜和酸的平衡像走钢丝；阿尔萨斯、奥地利瓦豪和澳大利亚克莱尔谷多酿成干型。陈年后会出现一种特别的“汽油”味，爱好者视为优点。',
           'Searingly high in acidity and pure in aroma, made in every style from bone dry to lusciously sweet, and able to age for decades. Mosel Rieslings are often only about 8% alcohol, walking a tightrope between sweetness and acidity; Alsace, the Wachau and Australia’s Clare Valley make it mostly dry. With age it picks up a note of petrol, which its fans prize.'],
    pair: ['川菜、泰国菜、猪肉、寿司', 'Sichuan and Thai food, pork, sushi'] },
  { id: 'chenin-blanc', c: 'white', name: ['白诗南', 'Chenin Blanc'], origin: ['法国卢瓦尔河谷', 'Loire, France'],
    s: { body: 3, acid: 5, aroma: 3 },
    notes: [['榅桲', 'quince'], ['苹果', 'apple'], ['蜂蜜', 'honey'], ['洋甘菊', 'chamomile'], ['羊毛脂', 'lanolin']],
    text: ['卢瓦尔河中游的白葡萄，酸度高、用途极广：干型（萨韦涅尔）、半甜、贵腐甜酒（莱昂丘）和起泡酒（武弗雷）都能酿。带榅桲、苹果和蜂蜜的味道，好酒能陈年几十年。南非种的白诗南比法国还多，斯瓦特兰的老藤尤其出色。',
           'The white grape of the middle Loire, high in acidity and endlessly versatile: dry (Savennières), off-dry, botrytised and sweet (Coteaux du Layon) and sparkling (Vouvray). It tastes of quince, apple and honey, and the best age for decades. South Africa grows more Chenin than France, and its old Swartland vines are especially fine.'],
    pair: ['猪肉、烤鸡、带甜味的亚洲菜', 'Pork, roast chicken, sweet-savoury Asian dishes'] },
  { id: 'semillon', c: 'white', name: ['赛美蓉', 'Sémillon'], origin: ['法国波尔多', 'Bordeaux, France'],
    s: { body: 4, acid: 2, aroma: 2 },
    notes: [['柠檬', 'lemon'], ['蜂蜡', 'beeswax'], ['蜂蜜', 'honey'], ['杏子', 'apricot'], ['烤面包', 'toast']],
    text: ['皮薄、容易感染贵腐菌，是苏玳和巴萨克贵腐甜酒的主力，带蜂蜜、杏子和蜂蜡香。在澳大利亚猎人谷，它被早早采收，酿成酒精只有 10%–11% 的干白，年轻时清淡如柠檬水，陈年十年后会神奇地出现烤面包和蜂蜜味。',
           'Thin-skinned and prone to noble rot, it is the backbone of sweet Sauternes and Barsac, with honey, apricot and beeswax. In Australia’s Hunter Valley it is picked early for dry whites of 10–11% that taste like lemon water when young and, after a decade, turn remarkably to toast and honey.'],
    pair: ['甜酒配鹅肝、蓝纹奶酪；干白配海鲜', 'Sweet: foie gras, blue cheese; dry: seafood'] },
  { id: 'pinot-gris', c: 'white', name: ['灰皮诺', 'Pinot Gris'], aka: ['', 'Pinot Grigio'], origin: ['法国勃艮第', 'Burgundy, France'],
    s: { body: 3, acid: 3, aroma: 3 },
    notes: [['梨', 'pear'], ['苹果', 'apple'], ['柠檬', 'lemon'], ['蜂蜜', 'honey'], ['烟熏', 'smoke']],
    text: ['黑皮诺的变种，果皮是灰粉色的。意大利叫它 Pinot Grigio，多半早采，酿成清淡爽口、带梨和柠檬味的日常白酒；阿尔萨斯的灰皮诺则成熟饱满，带蜂蜜、香料和一丝烟熏，常常微甜。',
           'A mutation of Pinot Noir with greyish-pink skins. As Pinot Grigio in Italy it is mostly picked early for light, crisp everyday whites tasting of pear and lemon; Alsace Pinot Gris is ripe and full, with honey, spice and a hint of smoke, often just off-dry.'],
    pair: ['海鲜意面、清淡的菜；阿尔萨斯的配白肉', 'Seafood pasta, light dishes; Alsace: white meat'] },
  { id: 'gewurztraminer', c: 'white', name: ['琼瑶浆', 'Gewürztraminer'], origin: ['德国西南部或法国东北部，名字来自意大利的特拉明', 'South-west Germany or north-east France; named after Tramin, Italy'],
    s: { body: 4, acid: 1, aroma: 5 },
    notes: [['荔枝', 'lychee'], ['玫瑰', 'rose'], ['姜', 'ginger'], ['香料', 'spice']],
    text: ['香气最浓烈的葡萄之一，一闻就是荔枝和玫瑰，还有姜和香料的味道（德语 Gewürz 就是“香料”）。酸度低、酒体丰满、酒精较高，常常微甜。阿尔萨斯的最好，很适合配带香料的中餐。',
           'One of the most aromatic grapes: lychee and roses at first sniff, then ginger and spice (Gewürz is German for spice). Low in acidity, full-bodied, fairly high in alcohol and often off-dry. Alsace makes the best, and it suits spiced Chinese food.'],
    pair: ['广式点心、咖喱、芒斯特奶酪', 'Dim sum, curry, Munster cheese'] },
  { id: 'viognier', c: 'white', name: ['维欧尼', 'Viognier'], origin: ['法国北罗讷', 'Northern Rhône, France'],
    s: { body: 4, acid: 2, aroma: 5 },
    notes: [['杏子', 'apricot'], ['桃子', 'peach'], ['金银花', 'honeysuckle'], ['橙花', 'orange blossom']],
    text: ['1960 年代全世界只剩不到 20 公顷，几乎都在北罗讷的孔德里约，之后才重新流行起来。酒体饱满、酸度低，带杏子、桃子和金银花的浓郁香气。罗蒂丘的西拉红酒可以混入最多 20% 的维欧尼一起发酵，颜色更稳定，香气也更芬芳。',
           'By the 1960s fewer than 20 hectares were left in the world, nearly all at Condrieu in the Northern Rhône, before it came back into fashion. Full-bodied and low in acidity, it smells richly of apricot, peach and honeysuckle. Côte-Rôtie may co-ferment up to 20% Viognier with its Syrah, which steadies the colour and lifts the scent.'],
    pair: ['香料烤鸡、咖喱、杏仁', 'Spiced chicken, curry, almonds'] },
  { id: 'gruner-veltliner', c: 'white', name: ['绿维特利纳', 'Grüner Veltliner'], origin: ['奥地利', 'Austria'],
    s: { body: 3, acid: 4, aroma: 3 },
    notes: [['白胡椒', 'white pepper'], ['青苹果', 'green apple'], ['柠檬', 'lemon'], ['青豆', 'green bean']],
    text: ['奥地利的国家葡萄，约占全国葡萄园的三分之一。招牌是一丝白胡椒的辛香，加上青苹果和柠檬，酸度清爽。瓦豪、克雷姆斯谷和坎普谷的顶级园能酿出饱满、可以陈年的版本。',
           'Austria’s national grape, about a third of its vineyards. Its signature is a twist of white pepper over green apple and lemon, with fresh acidity. From the top sites of the Wachau, Kremstal and Kamptal it makes full wines that age.'],
    pair: ['维也纳炸猪排、芦笋、越南菜', 'Wiener Schnitzel, asparagus, Vietnamese food'] },
  { id: 'albarino', c: 'white', name: ['阿尔巴利诺', 'Albariño'], aka: ['', 'Alvarinho'], origin: ['西班牙加利西亚', 'Galicia, Spain'],
    s: { body: 2, acid: 5, aroma: 4 },
    notes: [['柠檬', 'lemon'], ['桃子', 'peach'], ['杏子', 'apricot'], ['海盐', 'sea salt']],
    text: ['西班牙西北部加利西亚沿海的葡萄，葡萄牙北部叫它 Alvarinho。皮厚、耐潮湿，带桃子、柠檬和海风般的咸味，酸度清爽，天生配海鲜。下海湾的葡萄常搭在高高的棚架上，通风防霉。',
           'The grape of coastal Galicia in north-west Spain; northern Portugal calls it Alvarinho. Thick-skinned against the damp, it has peach, lemon and a sea-breeze salinity with crisp acidity, a born partner for seafood. In Rías Baixas the vines are often trained high on pergolas to keep the air moving and the mould away.'],
    pair: ['海鲜、烤鱿鱼、生蚝', 'Seafood, grilled squid, oysters'] },
  { id: 'muscat', c: 'white', name: ['麝香', 'Muscat'], aka: ['莫斯卡托', 'Moscato'], origin: ['地中海沿岸，古老的家族', 'An ancient Mediterranean family'],
    s: { body: 2, acid: 3, aroma: 5 },
    notes: [['鲜葡萄', 'fresh grape'], ['橙花', 'orange blossom'], ['玫瑰', 'rose'], ['桃子', 'peach']],
    text: ['一个古老的葡萄家族，少有的“酒闻起来真像新鲜葡萄”的品种。最精致的小粒白麝香（Muscat Blanc à Petits Grains）酿成意大利微甜微泡的莫斯卡托阿斯蒂、法国的博姆-德沃尼斯麝香甜酒，南非康斯坦提亚的传奇甜酒也用它。',
           'An ancient family of grapes, and the rare kind whose wine really smells of fresh grapes. Its finest member, Muscat Blanc à Petits Grains, makes Italy’s lightly sweet, lightly fizzy Moscato d’Asti, the sweet Muscat de Beaumes-de-Venise in France and South Africa’s legendary Constantia.'],
    pair: ['水果甜点、蛋糕', 'Fruit desserts, cake'] },
  { id: 'furmint', c: 'white', name: ['富尔民特', 'Furmint'], origin: ['匈牙利托卡伊', 'Tokaj, Hungary'],
    s: { body: 3, acid: 5, aroma: 3 },
    notes: [['青苹果', 'green apple'], ['梨', 'pear'], ['柑橘', 'citrus'], ['烟熏', 'smoke'], ['杏干', 'dried apricot']],
    text: ['托卡伊的主要品种，酸度极高、容易感染贵腐菌，是托卡伊阿苏贵腐甜酒的核心。近年托卡伊也用它酿干白，带青苹果、梨和一丝火山土壤般的烟熏感。',
           'The main grape of Tokaj: very high in acidity and prone to noble rot, the core of Tokaji Aszú. Lately Tokaj makes dry wines from it too, with green apple, pear and a smoky hint of its volcanic soils.'],
    pair: ['甜酒配鹅肝、蓝纹奶酪；干白配炖鸡', 'Sweet: foie gras, blue cheese; dry: chicken paprikash'] },
  { id: 'assyrtiko', c: 'white', name: ['阿斯提可', 'Assyrtiko'], origin: ['希腊圣托里尼', 'Santorini, Greece'],
    s: { body: 3, acid: 5, aroma: 3 },
    notes: [['柠檬', 'lemon'], ['海盐', 'sea salt'], ['打火石', 'flint'], ['蜂蜜', 'honey']],
    text: ['圣托里尼火山岛的葡萄，在炎热干燥的环境里依然保持很高的酸度，带柠檬、海盐和打火石般的味道。它也被种到希腊各地和澳大利亚，同样保有锋利的酸度。',
           'The grape of volcanic Santorini, which keeps its high acidity even in heat and drought, with lemon, sea salt and flint. Planted elsewhere in Greece and in Australia, it keeps its edge.'],
    pair: ['烤鱼、海鲜、希腊沙拉', 'Grilled fish, seafood, Greek salad'] },
  { id: 'palomino', c: 'white', name: ['帕洛米诺', 'Palomino'], origin: ['西班牙安达卢西亚', 'Andalusia, Spain'],
    s: { body: 2, acid: 2, aroma: 1 },
    notes: [['杏仁', 'almond'], ['面团', 'dough'], ['咸味', 'salinity'], ['核桃', 'walnut']],
    text: ['雪莉酒的葡萄。它本身酸度低、香气平淡，做干白很普通，却正好是一张白纸：雪莉的风味几乎全来自酒花和氧化陈年。赫雷斯周边白色的阿尔巴利萨（albariza）白垩土最适合它。',
           'The sherry grape. Low in acidity and neutral, it makes ordinary dry whites but a perfect blank page: nearly all of sherry’s flavour comes from flor and oxidative ageing. Its best soil is the white, chalky albariza around Jerez.'],
    pair: ['火腿、橄榄、炸海鲜；奥罗露索配炖肉', 'Ham, olives, fried seafood; Oloroso with stews'] },
  { id: 'glera', c: 'white', name: ['格雷拉', 'Glera'], origin: ['意大利东北部', 'North-east Italy'],
    s: { body: 1, acid: 4, aroma: 3 },
    notes: [['青苹果', 'green apple'], ['梨', 'pear'], ['白花', 'white flowers'], ['蜜瓜', 'melon']],
    text: ['普洛赛克的葡萄，2009 年以前它本身就叫 Prosecco，为了保护产区名才改了名字。用罐式法酿造，保留青苹果、梨和白花的清新香气，适合趁年轻喝。',
           'The grape of Prosecco, and until 2009 itself called Prosecco; it was renamed to protect the name of the place. Made by the tank method, it keeps fresh notes of green apple, pear and white flowers, and is best young.'],
    pair: ['开胃小食、意式前菜、炸物', 'Aperitivo snacks, antipasti, fried food'] },
  { id: 'rkatsiteli', c: 'white', name: ['白羽', 'Rkatsiteli'], origin: ['格鲁吉亚', 'Georgia'],
    s: { body: 3, acid: 5, aroma: 3 },
    notes: [['青苹果', 'green apple'], ['榅桲', 'quince'], ['干果', 'dried fruit'], ['红茶', 'black tea'], ['橙皮', 'orange peel']],
    text: ['格鲁吉亚最古老的白葡萄之一，酸度高、耐寒。用欧洲的方法酿是清爽的干白；在陶罐里带皮泡上几个月，就成了琥珀色、带单宁的橙酒，有干果、茶和橙皮的味道。苏联时期它被大量种植，1950 年代也引进到中国，叫“白羽”。',
           'One of Georgia’s oldest white grapes, high in acidity and hardy in cold. Made the European way it is a crisp dry white; left on its skins in qvevri for months it becomes an amber, tannic wine with dried fruit, tea and orange peel. It was planted widely in Soviet times and reached China in the 1950s, where it is called Baiyu (白羽).'],
    pair: ['烤鸡、核桃酱、香料菜', 'Roast chicken, walnut sauces, spiced dishes'] }
],

/* ---------------------------------------------------------------- 产区 Regions */
regions: [
  /* France */
  { id: 'bordeaux', name: ['波尔多', 'Bordeaux'], country: 'FR', view: 'france', lat: 44.97, lon: -0.53, glass: ['red'],
    climate: ['温和的海洋性气候', 'Mild, maritime'],
    grapes: ['cabernet-sauvignon', 'merlot', 'cabernet-franc', ['小维多', 'Petit Verdot'], 'sauvignon-blanc', 'semillon'],
    text: ['世界上最有名的红酒产区，以加龙河、多尔多涅河和两河汇成的吉伦特河口为界，分成左右两岸。左岸梅多克和格拉夫是砾石土，排水好、白天储热，正合晚熟的赤霞珠；右岸的圣埃美隆和波美侯以黏土和石灰岩为主，梅洛唱主角。1855 年的分级把酒庄分为五级（如今共 61 家，有几家是后来拆分的），至今只改过两次，五家一级庄是拉菲、拉图、玛歌、侯伯王和 1973 年升级的木桐。南边的苏玳出产世界顶级的贵腐甜酒。',
           'The most famous red wine region in the world, split into a Left and a Right Bank by the Garonne, the Dordogne and the Gironde estuary they form. On the Left Bank, the gravels of the Médoc and Graves drain well and hold the day’s heat, which late-ripening Cabernet Sauvignon needs; on the Right Bank, in Saint-Émilion and Pomerol, clay and limestone favour Merlot. The 1855 Classification ranked the châteaux in five growths (61 today, some split off since) and has changed only twice since; the first growths are Lafite, Latour, Margaux, Haut-Brion and Mouton, promoted in 1973. Sauternes, to the south, makes some of the world’s finest sweet wine.'],
    spots: [
      ['圣埃斯泰夫', 'Saint-Estèphe', 45.264, -0.771], ['波亚克', 'Pauillac', 45.200, -0.748], ['圣朱利安', 'Saint-Julien', 45.165, -0.741],
      ['玛歌', 'Margaux', 45.036, -0.670], ['佩萨克-雷奥良', 'Pessac-Léognan', 44.729, -0.600], ['苏玳', 'Sauternes', 44.533, -0.341],
      ['圣埃美隆', 'Saint-Émilion', 44.893, -0.156], ['波美侯', 'Pomerol', 44.931, -0.200], ['波尔多市', 'Bordeaux (city)', 44.841, -0.580, 1]
    ] },
  { id: 'burgundy', name: ['勃艮第', 'Burgundy'], country: 'FR', view: 'france', lat: 47.08, lon: 4.87, glass: ['red', 'white'],
    climate: ['凉爽的大陆性气候', 'Cool, continental'],
    grapes: ['pinot-noir', 'chardonnay', ['阿里高特', 'Aligoté']],
    text: ['勃艮第几乎只用两个品种，红酒用黑皮诺，白酒用霞多丽，酒的差别来自土地。中世纪的修道士把山坡分成一块块有名字的小地块“克里马”（climat），2015 年它们被列入世界遗产。核心是金丘：北段的夜丘以红酒闻名，南段的伯恩丘出产蒙哈榭、默尔索等顶级白酒。分级按地块而不是酒庄：特级园（全勃艮第 33 个）、一级园、村庄级和大区级。南边还有夏隆内丘和马贡，西北边是夏布利。',
           'Burgundy grows almost only two grapes, Pinot Noir for red and Chardonnay for white, and the differences come from the land. Medieval monks divided its slopes into small named plots, the climats, which became a World Heritage Site in 2015. Its heart is the Côte d’Or: the Côte de Nuits in the north for reds, the Côte de Beaune in the south for great whites such as Montrachet and Meursault. Burgundy ranks plots, not estates: Grand Cru (33 in all), Premier Cru, village and regional. The Côte Chalonnaise and the Mâconnais lie to the south, Chablis to the north-west.'],
    spots: [
      ['热夫雷-香贝丹', 'Gevrey-Chambertin', 47.226, 4.971], ['香波-慕西尼', 'Chambolle-Musigny', 47.186, 4.953], ['武若', 'Vougeot', 47.177, 4.964],
      ['沃恩-罗曼尼', 'Vosne-Romanée', 47.159, 4.955], ['夜圣乔治', 'Nuits-Saint-Georges', 47.137, 4.949], ['阿罗克斯-科尔登', 'Aloxe-Corton', 47.065, 4.860],
      ['伯恩', 'Beaune', 47.024, 4.838], ['波玛', 'Pommard', 47.009, 4.796], ['沃尔奈', 'Volnay', 47.002, 4.781],
      ['默尔索', 'Meursault', 46.978, 4.769], ['普里尼-蒙哈榭', 'Puligny-Montrachet', 46.949, 4.753], ['第戎', 'Dijon', 47.322, 5.041, 1]
    ] },
  { id: 'chablis', name: ['夏布利', 'Chablis'], country: 'FR', view: 'france', lat: 47.815, lon: 3.800, glass: ['white'],
    climate: ['凉爽的大陆性气候', 'Cool, continental'],
    grapes: ['chardonnay'],
    text: ['勃艮第最北端的产区，离金丘一百多公里，倒更靠近香槟。霞多丽长在启莫里阶（Kimmeridgian）石灰岩泥灰土上，土里满是远古的小牡蛎化石。酒大多不过桶或只用旧桶，冷冽、高酸，带柠檬、青苹果和湿石头般的味道，是生蚝的经典搭配。七块特级园挤在小镇东北的同一片山坡上。',
           'Burgundy’s northernmost district, over a hundred kilometres from the Côte d’Or and closer to Champagne. Its Chardonnay grows on Kimmeridgian limestone and marl full of tiny fossil oysters. The wines, mostly unoaked or aged in old barrels, are cool and taut, with lemon, green apple and wet stone, the classic match for oysters. The seven Grand Cru climats share one slope just north-east of the town.'] },
  { id: 'beaujolais', name: ['博若莱', 'Beaujolais'], country: 'FR', view: 'france', lat: 46.17, lon: 4.69, glass: ['red'],
    climate: ['温和的半大陆性气候', 'Mild, semi-continental'],
    grapes: ['gamay', 'chardonnay'],
    text: ['勃艮第南边、里昂北边的丘陵，几乎全种佳美。北部的花岗岩坡地上是十个特级村（cru），比如风车磨坊、福乐里和墨贡。很多酒用二氧化碳浸渍法酿造，果味鲜活、单宁很轻。每年 11 月第三个星期四上市的“博若莱新酒”让它出了名，但特级村的酒更严肃，也能陈年。',
           'The hills between Burgundy and Lyon, planted almost entirely with Gamay. Its northern granite slopes hold the ten crus, among them Moulin-à-Vent, Fleurie and Morgon. Many wines are made by carbonic maceration, bright and light in tannin. Beaujolais Nouveau, released on the third Thursday of November, made the name, but the crus are serious wines and can age.'],
    spots: [
      ['朱丽娜', 'Juliénas', 46.235, 4.711], ['福乐里', 'Fleurie', 46.192, 4.698], ['风车磨坊', 'Moulin-à-Vent', 46.189, 4.737],
      ['墨贡', 'Morgon', 46.161, 4.681], ['布鲁伊', 'Brouilly', 46.089, 4.646], ['索恩河畔自由城', 'Villefranche', 45.986, 4.727, 1]
    ] },
  { id: 'champagne', name: ['香槟', 'Champagne'], country: 'FR', view: 'france', lat: 49.05, lon: 4.00, glass: ['white'], fizz: true,
    climate: ['凉爽的大陆性气候', 'Cool, continental'],
    grapes: ['chardonnay', 'pinot-noir', ['莫尼耶', 'Meunier']],
    text: ['在巴黎东北约 140 公里，是法国最北的主要产区之一。这里太冷，葡萄很难完全成熟，基酒的酸度因此极高，正好适合酿起泡酒。白垩土里挖出的酒窖总长数百公里，常年保持在 10 °C 左右，是陈年的理想场所。三个主要品种是霞多丽、黑皮诺和莫尼耶。只有在这里按规定酿造的起泡酒才能叫“香槟”；产区里有 17 个特级村，2015 年它的山坡、酒庄和酒窖被列入世界遗产。',
           'About 140 km north-east of Paris, among France’s northernmost wine regions. It is so cool that the grapes struggle to ripen, which leaves the base wines very high in acidity, just what sparkling wine needs. Hundreds of kilometres of cellars cut into the chalk stay near 10 °C all year, ideal for ageing. The three main grapes are Chardonnay, Pinot Noir and Meunier. Only sparkling wine made here under its rules may be called Champagne; 17 of its villages are rated Grand Cru, and its hillsides, houses and cellars became a World Heritage Site in 2015.'],
    spots: [
      ['兰斯', 'Reims', 49.258, 4.032], ['韦尔兹奈', 'Verzenay', 49.159, 4.144], ['阿伊', 'Aÿ', 49.056, 4.015],
      ['埃佩尔奈', 'Épernay', 49.043, 3.953], ['阿维兹', 'Avize', 48.972, 4.010], ['莱利赛', 'Les Riceys', 47.994, 4.366]
    ] },
  { id: 'alsace', name: ['阿尔萨斯', 'Alsace'], country: 'FR', view: 'france', lat: 48.14, lon: 7.31, glass: ['white'],
    climate: ['干燥的半大陆性气候', 'Dry, semi-continental'],
    grapes: ['riesling', 'gewurztraminer', 'pinot-gris', 'muscat', ['西万尼', 'Sylvaner'], ['白皮诺', 'Pinot Blanc'], 'pinot-noir'],
    text: ['夹在孚日山脉和莱茵河之间，与德国一河之隔，历史上几度易手，所以用德国品种、德式长颈瓶，却是法国产区，而且少见地在酒标上写品种。孚日山挡住了西来的雨云，科尔马是法国最干燥的城市之一。雷司令、琼瑶浆、灰皮诺和麝香是“四大贵族品种”，51 个特级园基本只能用它们。',
           'Squeezed between the Vosges mountains and the Rhine, across the river from Germany, it changed hands several times, which is why its wines use German grapes and tall flute bottles while being French, and, unusually for France, name the grape on the label. The Vosges keep off the rain from the west, making Colmar one of France’s driest towns. Riesling, Gewurztraminer, Pinot Gris and Muscat are the four noble grapes, and the 51 Grands Crus are, with few exceptions, reserved for them.'],
    spots: [
      ['巴尔', 'Barr', 48.409, 7.449], ['里博维莱', 'Ribeauvillé', 48.192, 7.325], ['里克维尔', 'Riquewihr', 48.166, 7.298],
      ['凯泽斯贝尔', 'Kaysersberg', 48.157, 7.241], ['科尔马', 'Colmar', 48.078, 7.358], ['艾吉斯海姆', 'Eguisheim', 48.045, 7.308],
      ['盖布维莱尔', 'Guebwiller', 47.909, 7.211], ['斯特拉斯堡', 'Strasbourg', 48.585, 7.751, 1]
    ] },
  { id: 'loire', name: ['卢瓦尔河谷', 'Loire Valley'], country: 'FR', view: 'france', lat: 47.29, lon: 0.69, glass: ['white'],
    climate: ['下游海洋性，上游大陆性', 'Maritime downstream, continental upstream'],
    grapes: ['sauvignon-blanc', 'chenin-blanc', 'cabernet-franc', ['勃艮第香瓜', 'Melon de Bourgogne']],
    text: ['沿着法国最长的河流延伸数百公里的葡萄园带。入海口南特附近是清爽的蜜思卡岱；中游的安茹-索缪尔和都兰是白诗南（武弗雷、萨韦涅尔）和品丽珠（希农）的天下；上游的桑塞尔和普伊-富美是全世界长相思的标杆。河边城堡林立，中游河谷 2000 年被列入世界遗产。',
           'A ribbon of vineyards hundreds of kilometres long beside France’s longest river. Near Nantes, at its mouth, is crisp Muscadet; in the middle, Anjou-Saumur and Touraine belong to Chenin Blanc (Vouvray, Savennières) and Cabernet Franc (Chinon); upstream, Sancerre and Pouilly-Fumé set the world’s benchmark for Sauvignon Blanc. The château-lined middle valley became a World Heritage Site in 2000.'],
    spots: [
      ['蜜思卡岱', 'Muscadet', 47.161, -1.266], ['萨韦涅尔', 'Savennières', 47.383, -0.657], ['索缪尔', 'Saumur', 47.260, -0.079],
      ['希农', 'Chinon', 47.167, 0.240], ['武弗雷', 'Vouvray', 47.414, 0.800], ['桑塞尔', 'Sancerre', 47.331, 2.839],
      ['普伊-富美', 'Pouilly-Fumé', 47.281, 2.958], ['南特', 'Nantes', 47.219, -1.554, 1]
    ] },
  { id: 'rhone-north', name: ['北罗讷', 'Northern Rhône'], country: 'FR', view: 'france', lat: 45.19, lon: 4.82, glass: ['red'],
    climate: ['大陆性气候', 'Continental'],
    grapes: ['syrah', 'viognier', ['玛珊', 'Marsanne'], ['瑚珊', 'Roussanne']],
    text: ['里昂以南、罗讷河两岸陡峭的花岗岩梯田，狭长而小巧。红酒只用西拉：罗蒂丘优雅芬芳，可以混入少量维欧尼；埃米塔日浑厚耐陈；科尔纳斯粗犷有力。白酒有孔德里约的维欧尼，以及埃米塔日用玛珊和瑚珊酿的白酒。',
           'Steep granite terraces on both banks of the Rhône south of Lyon, narrow and small. The reds are Syrah alone: perfumed Côte-Rôtie, which may include a little Viognier; powerful, long-lived Hermitage; rugged Cornas. For white there is Viognier at Condrieu, and Marsanne and Roussanne at Hermitage.'],
    spots: [
      ['罗蒂丘', 'Côte-Rôtie', 45.489, 4.811], ['孔德里约', 'Condrieu', 45.462, 4.768], ['圣约瑟夫', 'Saint-Joseph', 45.083, 4.814],
      ['埃米塔日', 'Hermitage', 45.071, 4.837], ['克罗兹-埃米塔日', 'Crozes-Hermitage', 45.091, 4.846], ['科尔纳斯', 'Cornas', 44.964, 4.848],
      ['里昂', 'Lyon', 45.758, 4.832, 1]
    ] },
  { id: 'rhone-south', name: ['南罗讷', 'Southern Rhône'], country: 'FR', view: 'france', lat: 44.11, lon: 4.89, glass: ['red'],
    climate: ['地中海气候，密斯特拉风', 'Mediterranean, the mistral'],
    grapes: ['grenache', 'syrah', 'mourvedre', ['神索', 'Cinsault'], 'muscat'],
    text: ['从蒙特利马往南，河谷豁然开朗，变成平缓的地中海丘陵，强劲的密斯特拉风吹走湿气。这里的酒以歌海娜为主调配。最有名的是教皇新堡，允许使用 13 个品种，葡萄园里铺满吸热的圆形鹅卵石（galets roulés）。周边还有吉恭达斯、瓦给拉斯和只产桃红的塔维勒，罗讷河谷丘（Côtes du Rhône）的大部分酒也产自这里。',
           'South of Montélimar the valley opens into gentle Mediterranean country, swept dry by the mistral. Blends led by Grenache rule. The most famous is Châteauneuf-du-Pape, which allows 13 grape varieties and whose vineyards are strewn with round, heat-holding stones, the galets roulés. Around it lie Gigondas, Vacqueyras and Tavel, which makes only rosé, and most Côtes du Rhône comes from here too.'],
    spots: [
      ['拉斯多', 'Rasteau', 44.230, 4.986], ['吉恭达斯', 'Gigondas', 44.164, 5.005], ['瓦给拉斯', 'Vacqueyras', 44.138, 4.982],
      ['博姆-德沃尼斯', 'Beaumes-de-Venise', 44.122, 5.030], ['教皇新堡', 'Châteauneuf-du-Pape', 44.056, 4.832], ['利哈克', 'Lirac', 44.037, 4.691],
      ['塔维勒', 'Tavel', 44.013, 4.698], ['阿维尼翁', 'Avignon', 43.949, 4.806, 1]
    ] },
  { id: 'provence', name: ['普罗旺斯', 'Provence'], country: 'FR', view: 'france', lat: 43.38, lon: 6.05, glass: ['rose'],
    climate: ['地中海气候', 'Mediterranean'],
    grapes: ['grenache', ['神索', 'Cinsault'], 'syrah', 'mourvedre', ['侯尔', 'Rolle (Vermentino)']],
    text: ['法国最古老的葡萄酒产区：约公元前 600 年希腊人建立马赛时就带来了葡萄。如今以淡粉色的干型桃红闻名，桃红约占产量的九成，是全世界桃红的风向标。邦多尔如今也以桃红为主，但最有名的是以慕合怀特为主、浓郁耐陈的红酒；卡西斯以白酒著称。',
           'France’s oldest wine region: Greeks brought vines when they founded Marseille around 600 BC. Today it is known for pale, dry rosé, about nine bottles in ten of its wine and the model for rosé everywhere. Bandol, though it too now makes mostly rosé, is famous for dense, long-lived reds built on Mourvèdre; Cassis is known for whites.'],
    spots: [
      ['埃克斯丘', 'Coteaux d’Aix', 43.530, 5.447], ['卡西斯', 'Cassis', 43.214, 5.540], ['邦多尔', 'Bandol', 43.136, 5.752],
      ['普罗旺斯丘', 'Côtes de Provence', 43.463, 6.479], ['圣特罗佩', 'Saint-Tropez', 43.273, 6.641, 1]
    ] },
  { id: 'languedoc', name: ['朗格多克-鲁西荣', 'Languedoc-Roussillon'], country: 'FR', view: 'france', lat: 43.25, lon: 3.00, glass: ['red'],
    climate: ['地中海气候', 'Mediterranean'],
    grapes: ['grenache', 'syrah', 'mourvedre', ['佳丽酿', 'Carignan'], ['匹格普勒', 'Picpoul'], 'muscat'],
    text: ['从罗讷河口一直延伸到西班牙边境的地中海沿岸，是法国葡萄园面积最大的产区。这里曾以大量廉价酒著称，如今是法国最有活力的产区之一：皮克圣卢、福热尔、米内瓦和科比埃用西拉、歌海娜和老藤佳丽酿酿红酒；利穆宣称早在 1531 年就酿出了起泡酒；鲁西荣的巴纽尔斯出产加强型的甜红。',
           'The Mediterranean coast from the Rhône delta to the Spanish border, France’s largest wine region by area. Once known for oceans of cheap wine, it is now among the liveliest: Pic Saint-Loup, Faugères, Minervois and Corbières make reds from Syrah, Grenache and old-vine Carignan; Limoux claims to have made sparkling wine as early as 1531; and Banyuls, in Roussillon, makes sweet fortified reds.'],
    spots: [
      ['皮克圣卢', 'Pic Saint-Loup', 43.800, 3.872], ['福热尔', 'Faugères', 43.565, 3.190], ['皮内匹格普勒', 'Picpoul de Pinet', 43.407, 3.507],
      ['米内瓦', 'Minervois', 43.354, 2.746], ['科比埃', 'Corbières', 43.090, 2.621], ['利穆', 'Limoux', 43.054, 2.218],
      ['巴纽尔斯', 'Banyuls', 42.479, 3.128], ['蒙彼利埃', 'Montpellier', 43.611, 3.877, 1]
    ] },

  /* Italy */
  { id: 'piedmont', name: ['皮埃蒙特', 'Piedmont'], country: 'IT', view: 'italy', lat: 44.70, lon: 8.16, glass: ['red'],
    climate: ['大陆性气候，秋季多雾', 'Continental, with autumn fog'],
    grapes: ['nebbiolo', 'barbera', ['多姿桃', 'Dolcetto'], 'muscat', ['柯蒂斯', 'Cortese'], ['阿内斯', 'Arneis']],
    text: ['意大利西北部、阿尔卑斯山脚下，名字的意思就是“山脚”。朗格山丘出产两大内比奥罗名酒：被称为“酒中之王”的巴罗洛（至少陈年 38 个月，其中 18 个月在木桶），以及稍柔和的巴巴莱斯科。平时喝的是巴贝拉和多姿桃；阿斯蒂一带出产微甜微泡的莫斯卡托阿斯蒂。这里也是白松露的产地，阿尔巴每年秋天有松露节。',
           'North-west Italy at the foot of the Alps; the name means foot of the mountain. The Langhe hills make two great Nebbiolos: Barolo, the “king of wines” (at least 38 months’ ageing, 18 of them in wood), and the slightly gentler Barbaresco. Barbera and Dolcetto are for every day, and around Asti comes lightly sweet, fizzy Moscato d’Asti. It is white truffle country too, with a truffle fair at Alba every autumn.'],
    spots: [
      ['巴罗洛', 'Barolo', 44.615, 7.939], ['拉莫拉', 'La Morra', 44.652, 7.936], ['塞拉伦加', 'Serralunga d’Alba', 44.618, 7.997],
      ['巴巴莱斯科', 'Barbaresco', 44.719, 8.077], ['阿尔巴', 'Alba', 44.687, 8.031], ['阿斯蒂', 'Asti', 44.900, 8.207],
      ['卡内利', 'Canelli', 44.719, 8.287], ['加维', 'Gavi', 44.689, 8.806], ['都灵', 'Turin', 45.068, 7.682, 1]
    ] },
  { id: 'tuscany', name: ['托斯卡纳', 'Tuscany'], country: 'IT', view: 'italy', lat: 43.29, lon: 11.25, glass: ['red'],
    climate: ['地中海气候，内陆多丘陵', 'Mediterranean, inland hills'],
    grapes: ['sangiovese', 'cabernet-sauvignon', 'merlot', 'cabernet-franc', ['维奈西卡', 'Vernaccia']],
    text: ['桑娇维塞的故乡。佛罗伦萨和锡耶纳之间的基安蒂经典区是核心，瓶颈上印着黑公鸡；南边的蒙塔奇诺出产布鲁奈罗：全用桑娇维塞，至少在木桶里陈年两年，收获后第五年的 1 月 1 日才能上市；蒙特普尔恰诺出产贵族酒。1970 年代起，西边海岸的宝格丽用赤霞珠和梅洛酿出不守规矩的“超级托斯卡纳”，西施佳雅是先驱。',
           'The home of Sangiovese. Chianti Classico, between Florence and Siena, with a black rooster on the neck, is its heart; to the south, Montalcino makes Brunello, all Sangiovese, with at least two years in wood and released no earlier than 1 January of the fifth year after the harvest, and Montepulciano makes Vino Nobile. From the 1970s, at Bolgheri on the coast, Cabernet and Merlot made rule-breaking “Super Tuscans”, with Sassicaia the pioneer.'],
    spots: [
      ['基安蒂经典', 'Chianti Classico', 43.607, 11.332], ['圣吉米尼亚诺', 'San Gimignano', 43.468, 11.043], ['蒙塔奇诺', 'Montalcino', 43.058, 11.490],
      ['蒙特普尔恰诺', 'Montepulciano', 43.095, 11.783], ['宝格丽', 'Bolgheri', 43.234, 10.618], ['佛罗伦萨', 'Florence', 43.770, 11.256, 1],
      ['锡耶纳', 'Siena', 43.318, 11.331, 1]
    ] },
  { id: 'valpolicella', name: ['瓦坡里切拉', 'Valpolicella'], country: 'IT', view: 'italy', lat: 45.54, lon: 10.90, glass: ['red'],
    climate: ['温和，受加尔达湖调节', 'Mild, tempered by Lake Garda'],
    grapes: ['corvina', ['罗蒂内拉', 'Rondinella'], ['卡尔卡耐卡', 'Garganega']],
    text: ['维罗纳北面的山谷，以科维纳为主酿红酒。普通的瓦坡里切拉清爽易饮；把葡萄风干三四个月再酿，就是浓郁的阿玛罗尼（干型）和雷乔托（甜型）；把普通酒倒在阿玛罗尼剩下的果皮上再发酵一次，就是“里帕索”（Ripasso）。东边的索阿维用卡尔卡耐卡酿白酒，西边加尔达湖畔是巴多利诺。',
           'The valleys north of Verona, making reds mostly from Corvina. Plain Valpolicella is light and easy; dry the grapes for three or four months first and you get rich Amarone (dry) and Recioto (sweet); pass ordinary wine over Amarone’s leftover skins for a second fermentation and you get Ripasso. To the east, Soave makes white from Garganega; to the west, on Lake Garda, is Bardolino.'],
    spots: [
      ['富马内', 'Fumane', 45.581, 10.884], ['内格拉尔', 'Negrar', 45.539, 10.952], ['圣安布罗焦', 'Sant’Ambrogio', 45.522, 10.834],
      ['巴多利诺', 'Bardolino', 45.531, 10.692], ['索阿维', 'Soave', 45.436, 11.243], ['维罗纳', 'Verona', 45.442, 10.986, 1]
    ] },
  { id: 'prosecco', name: ['普洛赛克', 'Prosecco'], country: 'IT', view: 'italy', lat: 45.87, lon: 12.07, glass: ['white'], fizz: true,
    climate: ['温和湿润的丘陵', 'Mild, damp hills'],
    grapes: ['glera'],
    text: ['普洛赛克的产区很大，横跨威尼托和弗留利，但最好的来自威尼斯北面、科内利亚诺和瓦尔多比亚德内之间的陡峭丘陵，那里是 DOCG 产区，2019 年被列入世界遗产。罐式法酿造，带清新的青苹果和白花香，比香槟便宜得多，是世界上销量最大的起泡酒之一。',
           'Prosecco’s area is huge, spanning the Veneto and Friuli, but the best comes from the steep hills between Conegliano and Valdobbiadene north of Venice, a DOCG and since 2019 a World Heritage Site. Made by the tank method, fresh with green apple and white flowers and far cheaper than Champagne, it is one of the world’s best-selling sparkling wines.'],
    spots: [
      ['瓦尔多比亚德内', 'Valdobbiadene', 45.916, 12.027], ['科内利亚诺', 'Conegliano', 45.904, 12.265], ['阿索洛', 'Asolo', 45.801, 11.914],
      ['特雷维索', 'Treviso', 45.667, 12.243, 1], ['威尼斯', 'Venice', 45.437, 12.335, 1]
    ] },
  { id: 'friuli', name: ['弗留利', 'Friuli'], country: 'IT', view: 'italy', lat: 46.00, lon: 13.51, glass: ['white'],
    climate: ['阿尔卑斯山与亚得里亚海之间', 'Between the Alps and the Adriatic'],
    grapes: ['pinot-gris', 'sauvignon-blanc', ['弗留利诺', 'Friulano'], ['丽波拉', 'Ribolla Gialla']],
    text: ['意大利东北角，夹在阿尔卑斯山和亚得里亚海之间，与斯洛文尼亚接壤，出产意大利最好的白葡萄酒：有本地的弗留利诺和丽波拉，也有灰皮诺和长相思。1990 年代中后期，科利奥山区奥斯拉维亚村的拉迪孔（Stanko Radikon）和格拉夫纳（Josko Gravner）重新拾起长时间带皮发酵（拉迪孔用大橡木桶，格拉夫纳从 2001 年起改用格鲁吉亚陶罐），让橙酒在全世界复兴；边境另一侧斯洛文尼亚的布尔达是同一片山丘。',
           'Italy’s north-east corner, between the Alps and the Adriatic on the Slovenian border, and the source of the country’s best whites: local Friulano and Ribolla Gialla, as well as Pinot Grigio and Sauvignon Blanc. From the mid-1990s, in the Collio village of Oslavia, Stanko Radikon and Josko Gravner went back to long skin contact (Radikon in big oak vats, Gravner from 2001 in Georgian qvevri) and set off the worldwide revival of orange wine; Slovenia’s Brda, across the border, is the same range of hills.'],
    spots: [
      ['奇维达莱', 'Cividale', 46.073, 13.439], ['科尔蒙斯', 'Cormòns', 45.955, 13.462], ['奥斯拉维亚', 'Oslavia', 45.971, 13.613],
      ['布尔达（斯洛文尼亚）', 'Brda (Slovenia)', 45.997, 13.527], ['乌迪内', 'Udine', 46.063, 13.236, 1]
    ] },
  { id: 'sicily', name: ['西西里', 'Sicily'], country: 'IT', view: 'italy', lat: 37.45, lon: 14.15, glass: ['red'],
    climate: ['地中海气候，火山高地', 'Mediterranean, volcanic highlands'],
    grapes: [['黑达沃拉', 'Nero d’Avola'], ['奈莱洛·马斯卡斯', 'Nerello Mascalese'], ['卡利坎特', 'Carricante'], ['格里洛', 'Grillo'], 'muscat'],
    text: ['地中海最大的岛，过去以大量散装酒和加强型的马沙拉闻名，现在最受关注的是埃特纳火山：北坡海拔 400–1000 米的黑色火山土上，奈莱洛·马斯卡斯酿出像勃艮第一样轻盈通透的红酒。南部的黑达沃拉酿浓郁的红酒，西南的潘泰莱里亚岛用晒干的亚历山大麝香（Zibibbo）酿甜酒。',
           'The largest island in the Mediterranean, once known for bulk wine and fortified Marsala, and now above all for Mount Etna: on black volcanic soils 400 to 1,000 metres up its northern slopes, Nerello Mascalese makes reds as light and transparent as Burgundy. Nero d’Avola makes fuller reds in the south, and the island of Pantelleria makes sweet wine from sun-dried Zibibbo (Muscat of Alexandria).'],
    spots: [
      ['埃特纳火山', 'Etna', 37.883, 15.122], ['马沙拉', 'Marsala', 37.798, 12.434], ['维多利亚', 'Vittoria', 36.951, 14.530],
      ['诺托', 'Noto', 36.891, 15.071], ['潘泰莱里亚岛', 'Pantelleria', 36.831, 11.945], ['巴勒莫', 'Palermo', 38.111, 13.352, 1]
    ] },

  /* Spain and Portugal */
  { id: 'rioja', name: ['里奥哈', 'Rioja'], country: 'ES', view: 'iberia', lat: 42.44, lon: -2.40, glass: ['red'],
    climate: ['大陆性气候，受大西洋和地中海影响', 'Continental, with Atlantic and Mediterranean influence'],
    grapes: ['tempranillo', 'grenache', ['格拉西亚诺', 'Graciano'], ['马士罗', 'Mazuelo (Carignan)'], ['维奥娜', 'Viura']],
    text: ['西班牙最有名的产区，1991 年成为第一个 DOCa（最高等级）。沿埃布罗河分成上里奥哈、阿拉维萨和东里奥哈三部分。传统上按陈年时间分级：佳酿（Crianza）至少两年、其中一年在橡木桶；珍藏（Reserva）三年、一年在桶；特级珍藏（Gran Reserva）五年、两年在桶。橡木桶陈年是 19 世纪 50、60 年代由穆列塔（Luciano de Murrieta）和瑞格尔侯爵（Marqués de Riscal）从波尔多学来的；之后根瘤蚜摧毁法国葡萄园，波尔多酒商纷纷来到里奥哈，让这种做法普及开来。',
           'Spain’s best-known region, and in 1991 its first DOCa, the top tier. It runs along the Ebro in three parts, Rioja Alta, Rioja Alavesa and Rioja Oriental. Wines are traditionally graded by age: Crianza at least two years with one in oak, Reserva three with one in oak, Gran Reserva five with two in oak. Barrel ageing came from Bordeaux in the 1850s and 1860s with Luciano de Murrieta and the Marqués de Riscal; when phylloxera then ruined France’s vineyards, Bordeaux merchants came to Rioja and spread it.'],
    spots: [
      ['哈罗', 'Haro', 42.577, -2.847], ['拉瓜迪亚', 'Laguardia', 42.543, -2.581], ['洛格罗尼奥', 'Logroño', 42.466, -2.440],
      ['阿尔法罗', 'Alfaro', 42.179, -1.749]
    ] },
  { id: 'ribera', name: ['杜埃罗河岸', 'Ribera del Duero'], country: 'ES', view: 'iberia', lat: 41.65, lon: -4.04, glass: ['red'],
    climate: ['极端的大陆性高原气候', 'Extreme continental plateau'],
    grapes: ['tempranillo', 'cabernet-sauvignon', 'merlot', 'malbec'],
    text: ['卡斯蒂利亚高原上，杜埃罗河两岸的葡萄园海拔 750–1000 米，夏天白天炎热、夜里寒冷，昼夜温差常超过 20 °C，冬天严寒。丹魄在这里叫 Tinto Fino，酒色深、结构结实。维加西西里亚（Vega Sicilia）的 Único 是西班牙最有名的酒之一；1980 年代，美国酒评家帕克把佩斯格拉（Pesquera）比作“西班牙的柏图斯”，这里从此声名鹊起。',
           'On the Castilian plateau, the vineyards on both banks of the Duero lie 750 to 1,000 metres up; summer days are hot and nights cold, often over 20 °C apart, and winters are harsh. Tempranillo, called Tinto Fino here, makes dark, firmly built wines. Vega Sicilia’s Único is among Spain’s most famous wines; in the 1980s the American critic Robert Parker called Pesquera “the Pétrus of Spain”, and the region took off.'],
    spots: [
      ['瓦尔武埃纳', 'Valbuena de Duero', 41.642, -4.293], ['佩斯格拉', 'Pesquera de Duero', 41.642, -4.156], ['佩尼亚菲耶尔', 'Peñafiel', 41.597, -4.122],
      ['罗亚', 'Roa', 41.697, -3.928], ['阿兰达', 'Aranda de Duero', 41.672, -3.685]
    ] },
  { id: 'priorat', name: ['普里奥拉托', 'Priorat'], country: 'ES', view: 'iberia', lat: 41.19, lon: 0.82, glass: ['red'],
    climate: ['干燥的地中海-大陆性气候', 'Dry, Mediterranean to continental'],
    grapes: ['grenache', ['佳丽酿', 'Cariñena (Carignan)'], 'syrah', 'cabernet-sauvignon'],
    text: ['加泰罗尼亚的山区，12 世纪建立的斯卡拉-德伊修道院在这里种下葡萄。陡坡上是黑色的板岩土 llicorella，贫瘠得葡萄只结很少的果。1980 年代末，阿尔瓦罗·帕拉西奥斯（Álvaro Palacios）等五位酿酒师在格拉塔洛普斯村重振这里，用歌海娜和佳丽酿老藤酿出浓缩强劲的红酒。2000 年加泰罗尼亚授予它最高的 DOQ 等级，2009 年得到西班牙全国承认，成为继里奥哈之后的第二个 DOCa。',
           'Mountain country in Catalonia, where the priory of Scala Dei, founded in the 12th century, planted vines. Its steep slopes are black slate, llicorella, so poor the vines give little fruit. In the late 1980s five winemakers, Álvaro Palacios among them, revived it from the village of Gratallops with dense, powerful reds from old Grenache and Carignan. In 2000 Catalonia gave it its top tier, DOQ, recognised across Spain in 2009 as the country’s second DOCa after Rioja.'],
    spots: [
      ['斯卡拉-德伊', 'Scala Dei', 41.248, 0.811], ['波雷拉', 'Porrera', 41.189, 0.856], ['格拉塔洛普斯', 'Gratallops', 41.193, 0.777],
      ['法尔塞特', 'Falset', 41.145, 0.820, 1]
    ] },
  { id: 'penedes', name: ['佩内德斯', 'Penedès'], country: 'ES', view: 'iberia', lat: 41.38, lon: 1.74, glass: ['white'], fizz: true,
    climate: ['地中海气候', 'Mediterranean'],
    grapes: [['马卡贝奥', 'Macabeo'], ['沙雷洛', 'Xarel·lo'], ['帕雷亚达', 'Parellada'], 'chardonnay'],
    text: ['巴塞罗那西南的丘陵，是卡瓦（Cava）起泡酒的中心，大部分卡瓦产自圣萨杜尔尼-达诺亚镇一带。卡瓦和香槟一样用传统法酿造，主要品种是本地的马卡贝奥、沙雷洛和帕雷亚达，带柑橘和杏仁味，价格亲民。1872 年，约瑟夫·拉文托斯（Josep Raventós）在这里酿出第一批西班牙传统法起泡酒。',
           'The hills south-west of Barcelona and the centre of Cava, most of it made around the town of Sant Sadurní d’Anoia. Cava is made by the traditional method, like Champagne, mostly from local Macabeo, Xarel·lo and Parellada, with citrus and almond at friendly prices. In 1872 Josep Raventós made Spain’s first traditional-method sparkling wine here.'],
    spots: [
      ['圣萨杜尔尼-达诺亚', 'Sant Sadurní d’Anoia', 41.424, 1.786], ['比拉弗兰卡', 'Vilafranca del Penedès', 41.346, 1.700],
      ['巴塞罗那', 'Barcelona', 41.383, 2.177, 1]
    ] },
  { id: 'rias-baixas', name: ['下海湾', 'Rías Baixas'], country: 'ES', view: 'iberia', lat: 42.30, lon: -8.75, glass: ['white'],
    climate: ['凉爽多雨的大西洋气候', 'Cool and rainy, Atlantic'],
    grapes: ['albarino', ['特雷萨杜拉', 'Treixadura'], ['洛雷罗', 'Loureiro']],
    text: ['西班牙西北部加利西亚的大西洋海岸，长长的海湾（ría）深入内陆，凉爽多雨，是“绿色的西班牙”。几乎全种阿尔巴利诺，葡萄藤搭在花岗岩柱子撑起的高棚架上。酒清爽芳香，带桃子和海盐味，是当地海鲜的绝配。',
           'Galicia’s Atlantic coast in north-west Spain, where long inlets (rías) reach far inland; it is cool and rainy, “green Spain”. Nearly all of it is Albariño, trained high on pergolas held up by granite posts. The wines are crisp and fragrant, with peach and sea salt, perfect with the local seafood.'],
    spots: [
      ['坎巴多斯', 'Cambados', 42.519, -8.798], ['特亚县', 'Condado do Tea', 42.083, -8.499], ['奥罗萨尔', 'O Rosal', 41.937, -8.826],
      ['蓬特韦德拉', 'Pontevedra', 42.428, -8.604, 1]
    ] },
  { id: 'jerez', name: ['赫雷斯', 'Jerez'], country: 'ES', view: 'iberia', lat: 36.69, lon: -6.24, glass: ['amber'],
    climate: ['炎热的地中海气候，受海风调节', 'Hot Mediterranean, cooled by sea winds'],
    grapes: ['palomino', ['佩德罗-希梅内斯', 'Pedro Ximénez'], 'muscat'],
    text: ['雪莉酒的产区，安达卢西亚的“雪莉三角”：赫雷斯-德拉弗龙特拉、圣玛丽亚港和桑卢卡尔-德巴拉梅达。白色的阿尔巴利萨（albariza）白垩土像海绵一样在雨季吸水，供葡萄度过炎热干燥的夏天。桑卢卡尔靠海、湿润，酒花长得最旺，那里的菲诺叫曼萨尼亚（Manzanilla），带明显的咸味。',
           'Sherry country, the sherry triangle of Andalusia: Jerez de la Frontera, El Puerto de Santa María and Sanlúcar de Barrameda. The white albariza chalk soaks up winter rain like a sponge and feeds the vines through the hot, dry summer. In damp, seaside Sanlúcar the flor grows thickest, and its Fino, called Manzanilla, has a distinctly salty tang.'],
    spots: [
      ['赫雷斯-德拉弗龙特拉', 'Jerez de la Frontera', 36.682, -6.138], ['桑卢卡尔', 'Sanlúcar de Barrameda', 36.776, -6.353], ['圣玛丽亚港', 'El Puerto de Santa María', 36.600, -6.225]
    ] },
  { id: 'douro', name: ['杜罗河谷', 'Douro'], country: 'PT', view: 'iberia', lat: 41.17, lon: -7.55, glass: ['red'],
    climate: ['炎热干燥的大陆性气候', 'Hot, dry, continental'],
    grapes: ['touriga-nacional', ['多瑞加弗兰卡', 'Touriga Franca'], 'tempranillo'],
    text: ['葡萄牙北部杜罗河两岸的片岩陡坡，人工开凿的梯田层层叠叠，上杜罗 2001 年被列入世界遗产。1756 年这里划定了产区边界，是世界上最早的法定产区之一。它是波特酒的故乡，传统上酒在上游酿好，再运到河口、波尔图对岸的加亚新城陈年；如今这里的干红也越来越受重视。',
           'Steep schist slopes along the Douro in northern Portugal, carved by hand into terraces; the Alto Douro became a World Heritage Site in 2001. Its boundaries were drawn in 1756, making it one of the world’s first demarcated wine regions. It is the home of Port, traditionally made upriver and aged in Vila Nova de Gaia, across from Porto at the river’s mouth, and its dry reds are increasingly prized.'],
    spots: [
      ['加亚新城', 'Vila Nova de Gaia', 41.129, -8.606], ['雷瓜', 'Peso da Régua', 41.164, -7.788], ['皮尼昂', 'Pinhão', 41.191, -7.546],
      ['佩斯凯拉', 'São João da Pesqueira', 41.148, -7.404], ['福斯科阿', 'Foz Côa', 41.082, -7.142]
    ] },

  /* Germany, Austria, Hungary */
  { id: 'mosel', name: ['摩泽尔', 'Mosel'], country: 'DE', view: 'central', lat: 49.90, lon: 6.98, glass: ['white'],
    climate: ['凉爽的大陆性气候', 'Cool, continental'],
    grapes: ['riesling', ['米勒-图高', 'Müller-Thurgau'], ['艾伯灵', 'Elbling']],
    text: ['摩泽尔河在德国西部的深谷里蜿蜒，朝南的陡峭板岩坡把阳光和热量反射给葡萄，让雷司令在北纬 50° 附近也能成熟。布雷姆的卡尔蒙特（Calmont）常被称为欧洲最陡的葡萄园。这里的雷司令酒精低、酸度高、常带甜味，按采收时的成熟度分为珍藏（Kabinett）、晚收（Spätlese）、精选（Auslese）等级别。支流萨尔河和鲁沃河也属于这个产区。',
           'The Mosel winds through deep valleys in western Germany, and its steep, south-facing slate slopes throw sun and heat back onto the vines, letting Riesling ripen near 50° north. The Calmont at Bremm is often called the steepest vineyard in Europe. The Rieslings are low in alcohol, high in acidity and often sweet, graded by ripeness at harvest: Kabinett, Spätlese, Auslese and up. The tributary Saar and Ruwer belong to the region too.'],
    spots: [
      ['萨尔堡', 'Saarburg', 49.608, 6.549], ['特里尔', 'Trier', 49.760, 6.644, 1], ['特里滕海姆', 'Trittenheim', 49.822, 6.900],
      ['皮斯波特', 'Piesport', 49.881, 6.920], ['伯恩卡斯特', 'Bernkastel', 49.916, 7.071], ['于尔齐希', 'Ürzig', 49.979, 7.006],
      ['布雷姆', 'Bremm', 50.098, 7.120]
    ] },
  { id: 'rheingau', name: ['莱茵高', 'Rheingau'], country: 'DE', view: 'central', lat: 50.01, lon: 8.05, glass: ['white'],
    climate: ['凉爽，受莱茵河调节', 'Cool, tempered by the Rhine'],
    grapes: ['riesling', 'pinot-noir'],
    text: ['莱茵河在这里拐了个弯，向西流了约 30 公里，北岸的葡萄园因此整片朝南，背后的陶努斯山挡住北风。雷司令约占八成。传说 1775 年约翰山堡因为送信的人迟到、晚摘了葡萄，意外“发现”了晚收酒；埃伯巴赫修道院是中世纪的酿酒重镇。东头的霍赫海姆是英国人把德国白酒叫作 hock 的由来。',
           'Here the Rhine turns to flow west for about 30 km, so the vineyards on its north bank all face south, sheltered by the Taunus hills behind. About four-fifths is Riesling. At Schloss Johannisberg, the story goes, a late courier in 1775 delayed the harvest and so “discovered” Spätlese; Kloster Eberbach was a great medieval wine abbey. Hochheim, at the eastern end, is why the English call German white wine hock.'],
    spots: [
      ['阿斯曼斯豪森', 'Assmannshausen', 49.989, 7.865], ['吕德斯海姆', 'Rüdesheim', 49.979, 7.924], ['约翰山堡', 'Schloss Johannisberg', 50.000, 7.984],
      ['哈滕海姆', 'Hattenheim', 50.015, 8.056], ['埃尔特维勒', 'Eltville', 50.022, 8.104], ['霍赫海姆', 'Hochheim', 50.028, 8.359]
    ] },
  { id: 'pfalz', name: ['法尔兹', 'Pfalz'], country: 'DE', view: 'central', lat: 49.34, lon: 8.13, glass: ['white'],
    climate: ['温暖干燥（就德国而言）', 'Warm and dry, for Germany'],
    grapes: ['riesling', 'pinot-noir', 'pinot-gris', ['白皮诺', 'Weissburgunder'], ['丹菲特', 'Dornfelder']],
    text: ['阿尔萨斯往北的延续，哈尔特山（孚日山在德国的部分）挡住雨水，是德国最温暖、阳光最充足的产区之一，杏仁树、无花果甚至柠檬都能生长。面积在德国排第二，以饱满的干型雷司令和黑皮诺著称，福斯特、代德斯海姆一带的“中哈尔特”是最好的地段。“德国葡萄酒之路”从南到北贯穿全区。',
           'The northward continuation of Alsace, sheltered by the Haardt hills, the German end of the Vosges, and one of Germany’s warmest, sunniest regions, where almonds, figs and even lemons grow. Second in Germany by area, it is known for full dry Rieslings and Pinot Noir, with the Mittelhaardt around Forst and Deidesheim the finest stretch. The German Wine Route runs its length.'],
    spots: [
      ['巴特迪克海姆', 'Bad Dürkheim', 49.463, 8.171], ['福斯特', 'Forst', 49.426, 8.190], ['代德斯海姆', 'Deidesheim', 49.408, 8.186],
      ['诺伊施塔特', 'Neustadt', 49.354, 8.136], ['施韦根', 'Schweigen', 49.055, 7.956]
    ] },
  { id: 'wachau', name: ['瓦豪', 'Wachau'], country: 'AT', view: 'central', lat: 48.39, lon: 15.48, glass: ['white'],
    climate: ['东边的暖空气与北边的冷空气交汇', 'Warm air from the east meets cool air from the north'],
    grapes: ['gruner-veltliner', 'riesling'],
    text: ['多瑙河在维也纳以西切出的一段峡谷，两岸是几百年来用石墙垒起的片麻岩梯田，2000 年被列入世界遗产。东边潘诺尼亚平原的暖空气和北边森林的冷空气在这里交汇，昼夜温差大。主角是绿维特利纳和雷司令，酒农协会按酒精度把酒分成三级：Steinfeder（不超过 11.5%，得名于当地一种羽毛草）、Federspiel（得名于驯鹰）和 Smaragd（12.5% 以上，得名于翠绿的蜥蜴）。下游的克雷姆斯谷和坎普谷风格相近。',
           'A gorge the Danube cuts west of Vienna, its banks lined with gneiss terraces held up by stone walls built over centuries; it became a World Heritage Site in 2000. Warm air from the Pannonian plain to the east meets cool air from the forests to the north, so nights are much cooler than days. Grüner Veltliner and Riesling lead, and the growers’ association grades the wines by alcohol: Steinfeder (up to 11.5%, named for a feather grass), Federspiel (for falconry) and Smaragd (12.5% and up, for an emerald lizard). Kremstal and Kamptal, downstream, are in the same vein.'],
    spots: [
      ['施皮茨', 'Spitz', 48.361, 15.413], ['魏森基兴', 'Weißenkirchen', 48.397, 15.470], ['迪恩施坦', 'Dürnstein', 48.395, 15.520],
      ['洛伊本', 'Loiben', 48.387, 15.541], ['克雷姆斯（克雷姆斯谷）', 'Krems (Kremstal)', 48.411, 15.600], ['朗根洛伊斯（坎普谷）', 'Langenlois (Kamptal)', 48.494, 15.650],
      ['维也纳', 'Vienna', 48.208, 16.373, 1]
    ] },
  { id: 'tokaj', name: ['托卡伊', 'Tokaj'], country: 'HU', view: 'central', lat: 48.24, lon: 21.42, glass: ['amber'],
    climate: ['大陆性气候，秋季河雾', 'Continental, misty river autumns'],
    grapes: ['furmint', ['哈斯莱威路', 'Hárslevelű'], 'muscat'],
    text: ['匈牙利东北部的火山丘陵，博德罗格河在这里汇入蒂萨河，秋天的河雾给贵腐菌创造了条件。托卡伊阿苏是世界上最古老的贵腐甜酒之一，据说法王路易十四称它为“王者之酒，酒中之王”。1737 年的一道王室法令划定了这里的边界，使它成为世界上最早的封闭式法定产区之一。最珍贵的精华酒（Eszencia）是贵腐果粒靠自身重量渗出的汁，甜得惊人，酒精常常只有百分之几。',
           'Volcanic hills in north-east Hungary where the Bodrog meets the Tisza, and autumn river mists bring on noble rot. Tokaji Aszú is among the oldest botrytised sweet wines; Louis XIV is said to have called it “the wine of kings, the king of wines”. A royal decree drew its boundaries in 1737, making it one of the world’s first closed wine regions. The rarest wine, Eszencia, is the juice that seeps from aszú berries under their own weight: astonishingly sweet, and often only a few per cent alcohol.'],
    spots: [
      ['沙托劳尔尧乌伊海伊', 'Sátoraljaújhely', 48.396, 21.656], ['沙罗什保陶克', 'Sárospatak', 48.322, 21.566], ['托尔奇瓦', 'Tolcsva', 48.283, 21.449],
      ['马德', 'Mád', 48.192, 21.274], ['塔利亚', 'Tállya', 48.235, 21.230], ['塔尔曹尔', 'Tarcal', 48.130, 21.346],
      ['托卡伊镇', 'Tokaj (town)', 48.124, 21.411]
    ] },

  /* Elsewhere in Europe */
  { id: 'santorini', name: ['圣托里尼', 'Santorini'], country: 'GR', view: 'europe', lat: 36.39, lon: 25.43, glass: ['white'],
    climate: ['炎热、干燥、多风', 'Hot, dry, windy'],
    grapes: ['assyrtiko', ['艾达尼', 'Aidani'], ['阿希里', 'Athiri']],
    text: ['爱琴海上的火山岛，约公元前 1600 年的一次大喷发塑造了它今天的月牙形。土壤是火山灰和浮石，几乎没有黏土，根瘤蚜无法生存，所以葡萄从没嫁接过，有的根系已有几百年。夏天几乎不下雨，葡萄靠夜间海雾的湿气生长；为了挡风，藤蔓被编成贴着地面的篮子形状（kouloura）。岛上也用晒干的葡萄酿甜酒 Vinsanto。',
           'A volcanic island in the Aegean, shaped into its crescent by a huge eruption around 1600 BC. The soil is ash and pumice with almost no clay, so phylloxera cannot live in it: the vines have never been grafted, and some root systems are centuries old. It barely rains in summer and the vines live on the moisture of the night sea mist; against the wind they are woven into low baskets, kouloura. The island also makes a sweet Vinsanto from sun-dried grapes.'],
    spots: [
      ['伊亚', 'Oia', 36.462, 25.376], ['皮尔戈斯', 'Pyrgos', 36.383, 25.450], ['梅加洛霍里', 'Megalochori', 36.376, 25.432],
      ['恩波里奥', 'Emporio', 36.357, 25.446]
    ] },
  { id: 'kakheti', name: ['卡赫季', 'Kakheti'], country: 'GE', view: 'europe', lat: 41.82, lon: 45.72, glass: ['amber'],
    climate: ['大陆性气候，大高加索山挡住北方冷空气', 'Continental, sheltered by the Greater Caucasus'],
    grapes: ['saperavi', 'rkatsiteli', ['姆茨瓦内', 'Mtsvane']],
    text: ['格鲁吉亚东部的阿拉扎尼河谷，大高加索山挡住北方的冷空气，这里出产全国大约七成的葡萄酒。格鲁吉亚被认为是葡萄酒的发源地之一：考古学家在格鲁吉亚南部发现了约公元前 6000 年、残留葡萄酒成分的陶器碎片。传统的卡赫季酿法把白葡萄连皮带梗放进埋在地下的 qvevri 陶罐里泡上半年，酿出琥珀色的酒。茨南达利、穆库扎尼和金兹马拉乌利都是有名的村庄产区。',
           'The Alazani valley in eastern Georgia, sheltered from northern cold by the Greater Caucasus, makes about 70% of the country’s wine. Georgia is counted among the birthplaces of wine: in the south of the country archaeologists found pottery with traces of wine from about 6000 BC. The traditional Kakhetian method leaves white grapes, skins, stems and all, in buried qvevri for half a year, for amber wines. Tsinandali, Mukuzani and Kindzmarauli are well-known village appellations.'],
    spots: [
      ['克瓦雷利（金兹马拉乌利）', 'Kvareli (Kindzmarauli)', 41.948, 45.814], ['泰拉维', 'Telavi', 41.920, 45.470], ['茨南达利', 'Tsinandali', 41.894, 45.573],
      ['古尔贾阿尼', 'Gurjaani', 41.746, 45.795], ['穆库扎尼', 'Mukuzani', 41.807, 45.732], ['西格纳吉', 'Sighnaghi', 41.619, 45.923],
      ['第比利斯', 'Tbilisi', 41.693, 44.801, 1]
    ] },

  /* North America */
  { id: 'napa', name: ['纳帕谷', 'Napa Valley'], country: 'US', view: 'california', lat: 38.46, lon: -122.42, glass: ['red'],
    climate: ['地中海气候，海湾雾气降温', 'Mediterranean, cooled by bay fog'],
    grapes: ['cabernet-sauvignon', 'merlot', 'cabernet-franc', 'chardonnay', 'sauvignon-blanc'],
    text: ['旧金山以北约一小时车程的狭长山谷，长约 50 公里，产量只占加州葡萄酒的约 4%，却是美国最有名的产区。南端靠近圣帕布罗湾，雾气和海风让卡内罗斯凉爽，适合霞多丽和黑皮诺；越往北越热，卢瑟福、奥克维尔一带的冲积扇是赤霞珠的黄金地段。1976 年的“巴黎审判”盲品中，纳帕鹿跃酒窖的赤霞珠和蒙特莱那酒庄的霞多丽击败法国名庄，让加州一举成名。',
           'A narrow valley about an hour north of San Francisco and some 50 km long. It makes only about 4% of California’s wine yet is America’s most famous region. At the southern end, fog and wind off San Pablo Bay keep Carneros cool, for Chardonnay and Pinot Noir; it warms as you go north, and the alluvial fans around Rutherford and Oakville are the heartland of Cabernet. At the 1976 “Judgment of Paris” blind tasting, a Stag’s Leap Wine Cellars Cabernet and a Chateau Montelena Chardonnay beat famous French wines and put California on the map.'],
    spots: [
      ['卡利斯托加', 'Calistoga', 38.579, -122.580], ['豪厄尔山', 'Howell Mountain', 38.578, -122.449], ['圣海伦娜', 'St. Helena', 38.505, -122.470],
      ['卢瑟福', 'Rutherford', 38.457, -122.421], ['奥克维尔', 'Oakville', 38.439, -122.407], ['鹿跃区', 'Stags Leap District', 38.399, -122.323],
      ['卡内罗斯', 'Los Carneros', 38.242, -122.325], ['纳帕市', 'Napa (city)', 38.297, -122.286, 1]
    ] },
  { id: 'sonoma', name: ['索诺玛', 'Sonoma'], country: 'US', view: 'california', lat: 38.53, lon: -122.88, glass: ['red', 'white'],
    climate: ['地中海气候，太平洋海雾', 'Mediterranean, Pacific fog'],
    grapes: ['pinot-noir', 'chardonnay', 'zinfandel', 'cabernet-sauvignon', 'sauvignon-blanc'],
    text: ['纳帕西边的邻居，面积更大、更多样，从太平洋海岸一直延伸到内陆山谷。俄罗斯河谷和索诺玛海岸受海雾影响，出产加州最好的黑皮诺和霞多丽；干溪谷以老藤仙粉黛著称；温暖的亚历山大谷种赤霞珠。它比纳帕更有乡村味，很多酒庄仍是家族经营。',
           'Napa’s neighbour to the west, larger and more varied, reaching from the Pacific coast to inland valleys. Fog-cooled Russian River Valley and the Sonoma Coast make some of California’s best Pinot Noir and Chardonnay; Dry Creek Valley is known for old-vine Zinfandel; warmer Alexander Valley grows Cabernet. It feels more rural than Napa, and many wineries are still family-run.'],
    spots: [
      ['亚历山大谷', 'Alexander Valley', 38.713, -122.901], ['干溪谷', 'Dry Creek Valley', 38.660, -122.935], ['俄罗斯河谷', 'Russian River Valley', 38.484, -122.886],
      ['索诺玛海岸', 'Sonoma Coast', 38.514, -123.244], ['索诺玛谷', 'Sonoma Valley', 38.292, -122.458]
    ] },
  { id: 'central-coast', name: ['中央海岸', 'Central Coast'], country: 'US', view: 'california', lat: 35.61, lon: -120.86, glass: ['red'],
    climate: ['海风和海雾调节', 'Tempered by sea wind and fog'],
    grapes: ['pinot-noir', 'chardonnay', 'syrah', 'zinfandel', 'cabernet-sauvignon', 'grenache'],
    text: ['从旧金山湾南边一直到圣巴巴拉，绵延约 400 公里。北段的圣克鲁兹山出产耐陈的赤霞珠，Ridge 酒庄的 Monte Bello 也参加过 1976 年的巴黎审判；中段的帕索罗布尔斯炎热，以罗讷品种和仙粉黛见长；南端圣巴巴拉的山谷少见地呈东西走向，太平洋的冷风长驱直入，圣丽塔山和圣玛丽亚谷因此成为黑皮诺和霞多丽的胜地，电影《杯酒人生》就在这里取景。',
           'From south of San Francisco Bay to Santa Barbara, some 400 km. In the north, the Santa Cruz Mountains make long-lived Cabernet (Ridge’s Monte Bello was at the 1976 Judgment of Paris); hot Paso Robles, in the middle, does well with Rhône grapes and Zinfandel; and at the southern end the Santa Barbara valleys run, unusually, east to west, letting cold Pacific air straight in, which makes the Sta. Rita Hills and Santa Maria Valley prime ground for Pinot Noir and Chardonnay. The film Sideways was shot here.'],
    spots: [
      ['圣克鲁兹山', 'Santa Cruz Mountains', 37.264, -122.023], ['圣露西亚高地', 'Santa Lucia Highlands', 36.508, -121.445], ['帕索罗布尔斯', 'Paso Robles', 35.626, -120.690],
      ['圣玛丽亚谷', 'Santa Maria Valley', 34.953, -120.436], ['圣丽塔山', 'Sta. Rita Hills', 34.639, -120.458], ['圣伊内斯谷', 'Santa Ynez Valley', 34.668, -120.115],
      ['旧金山', 'San Francisco', 37.788, -122.408, 1]
    ] },
  { id: 'willamette', name: ['威拉米特谷', 'Willamette Valley'], country: 'US', view: 'pnw', lat: 45.24, lon: -123.11, glass: ['red'],
    climate: ['凉爽湿润的海洋性气候', 'Cool and damp, maritime'],
    grapes: ['pinot-noir', 'pinot-gris', 'chardonnay'],
    text: ['俄勒冈州波特兰以南的河谷，北纬 45° 左右，和勃艮第（47°）相近，凉爽湿润。1965 年大卫·莱特（David Lett）在这里种下第一批黑皮诺；1979 年他的酒在巴黎的一次评比中名列前茅，引起轰动。1987 年勃艮第的杜鲁安（Drouhin）家族也来这里建园。邓迪山红色的火山土 Jory 和埃奥拉-阿米蒂山的海风是这里的名片。',
           'The river valley south of Portland, Oregon, near 45° north, close to Burgundy’s 47°, cool and damp. David Lett planted its first Pinot Noir in 1965; in 1979 his wine placed near the top of a tasting in Paris and caused a stir, and in 1987 Burgundy’s Drouhin family came to plant here too. The red volcanic Jory soil of the Dundee Hills and the sea winds of the Eola-Amity Hills are its calling cards.'],
    spots: [
      ['切哈勒姆山', 'Chehalem Mountains', 45.300, -122.973], ['邓迪山', 'Dundee Hills', 45.278, -123.011], ['扬希尔-卡尔顿', 'Yamhill-Carlton', 45.294, -123.176],
      ['麦克明维尔', 'McMinnville', 45.210, -123.194], ['埃奥拉-阿米蒂山', 'Eola-Amity Hills', 45.118, -123.206], ['波特兰', 'Portland', 45.520, -122.674, 1],
      ['塞勒姆', 'Salem', 44.939, -123.033, 1]
    ] },
  { id: 'columbia', name: ['哥伦比亚谷', 'Columbia Valley'], country: 'US', view: 'pnw', lat: 46.24, lon: -119.42, glass: ['red'],
    climate: ['干燥的半沙漠大陆性气候', 'Dry, semi-desert, continental'],
    grapes: ['cabernet-sauvignon', 'merlot', 'syrah', 'riesling', 'chardonnay'],
    text: ['华盛顿州喀斯喀特山脉以东的大片半沙漠，年降雨只有 150–250 毫米，全靠哥伦比亚河等河水灌溉。纬度高，夏季白天长、夜里凉，葡萄熟得透又保得住酸度。华盛顿是美国第二大葡萄酒产地，这里的赤霞珠、梅洛、西拉和雷司令都很出色，红山和瓦拉瓦拉是有名的子产区。冬天寒冷、土壤多沙，根瘤蚜长期难以立足，很多葡萄没有嫁接；不过 2019 年起，瓦拉瓦拉、雅基马谷等地已陆续发现根瘤蚜。',
           'A vast semi-desert east of Washington’s Cascade Mountains, with only 150 to 250 mm of rain a year, farmed with water from the Columbia and other rivers. At this latitude summer days are long and nights cool, so grapes ripen fully and keep their acidity. Washington is America’s second-largest wine state, with fine Cabernet, Merlot, Syrah and Riesling; Red Mountain and Walla Walla are well-known sub-regions. Cold winters and sandy soils long kept phylloxera at bay, so many vines grow on their own roots, though since 2019 it has turned up in Walla Walla, the Yakima Valley and elsewhere.'],
    spots: [
      ['雅基马谷', 'Yakima Valley', 46.207, -119.769], ['红山', 'Red Mountain', 46.263, -119.488], ['瓦拉瓦拉', 'Walla Walla', 46.065, -118.343],
      ['马天堂山', 'Horse Heaven Hills', 45.937, -119.603], ['瓦卢克坡', 'Wahluke Slope', 46.738, -119.903]
    ] },
  { id: 'finger-lakes', name: ['五指湖', 'Finger Lakes'], country: 'US', view: 'nyon', lat: 42.60, lon: -76.98, glass: ['white'],
    climate: ['寒冷的大陆性气候，深湖调节', 'Cold continental, tempered by deep lakes'],
    grapes: ['riesling', 'cabernet-franc', 'pinot-noir', 'gewurztraminer'],
    text: ['纽约州西部一组冰川刻出的狭长深湖，像张开的手指。塞内卡湖深达 188 米，冬天很少结冰、夏天蓄满热量，护着湖边坡地上的葡萄度过严冬。1950 年代，来自乌克兰的康斯坦丁·弗兰克（Konstantin Frank）博士证明欧洲酿酒葡萄也能在这里过冬，如今这里是美国最好的雷司令产区之一。',
           'A set of long, deep glacial lakes in western New York, splayed like fingers. Seneca Lake, 188 metres deep, rarely freezes and stores summer heat, carrying the vines on its slopes through hard winters. In the 1950s Dr Konstantin Frank, from Ukraine, showed that European wine grapes could survive here, and it is now among America’s best regions for Riesling.'],
    spots: [
      ['卡南代瓜湖', 'Canandaigua Lake', 42.887, -77.281], ['塞内卡湖', 'Seneca Lake', 42.869, -76.979], ['库卡湖', 'Keuka Lake', 42.408, -77.224],
      ['沃特金斯峡谷', 'Watkins Glen', 42.381, -76.871], ['卡尤加湖', 'Cayuga Lake', 42.437, -76.548]
    ] },
  { id: 'niagara', name: ['尼亚加拉半岛', 'Niagara Peninsula'], country: 'CA', view: 'nyon', lat: 43.19, lon: -79.31, glass: ['amber'],
    climate: ['凉爽的大陆性气候，安大略湖调节', 'Cool continental, tempered by Lake Ontario'],
    grapes: ['riesling', 'cabernet-franc', 'chardonnay', ['威代尔', 'Vidal']],
    text: ['加拿大安大略省、夹在安大略湖和伊利湖之间的半岛。尼亚加拉悬崖挡住风，湖水调节温度，留出一条适合葡萄的狭长地带。这里每年冬天都足够冷，是世界上最稳定的冰酒产区：按加拿大 VQA 的规定，冰酒葡萄必须在 −8 °C 或更冷时、在树上自然冻结后采摘。1991 年，云岭酒庄（Inniskillin）的威代尔冰酒在法国 Vinexpo 获得大奖，让加拿大冰酒闻名世界。',
           'The peninsula between Lake Ontario and Lake Erie in Ontario, Canada. The Niagara Escarpment breaks the wind and the lakes temper the climate, leaving a narrow strip fit for grapes. Its winters are reliably cold enough for ice wine, which Canada’s VQA rules say must be picked frozen naturally on the vine, at −8 °C or colder. In 1991 Inniskillin’s Vidal ice wine won the top prize at Vinexpo in France and made Canadian ice wine famous.'],
    spots: [
      ['湖边尼亚加拉', 'Niagara-on-the-Lake', 43.256, -79.072], ['二十英里台地', 'Twenty Mile Bench', 43.145, -79.369], ['比姆斯维尔台地', 'Beamsville Bench', 43.165, -79.475]
    ] },

  /* South America */
  { id: 'casablanca', name: ['卡萨布兰卡谷', 'Casablanca Valley'], country: 'CL', view: 'southam', lat: -33.36, lon: -71.42, glass: ['white'],
    climate: ['凉爽，受洪堡寒流影响', 'Cool, from the Humboldt current'],
    grapes: ['sauvignon-blanc', 'chardonnay', 'pinot-noir'],
    text: ['圣地亚哥和瓦尔帕莱索之间、离太平洋只有约 30 公里的山谷。从南极北上的洪堡寒流让沿海凉爽多雾，午后海风强劲。它从 1980 年代起开始种植，是智利第一个出名的冷凉白葡萄酒产区，出产清爽的长相思和霞多丽。南边的莱达离海更近，更冷。',
           'A valley between Santiago and Valparaíso, only about 30 km from the Pacific. The cold Humboldt current, flowing up from Antarctica, makes the coast cool and foggy, with strong afternoon sea winds. Planted from the 1980s, it was Chile’s first famous cool-climate white wine region, for crisp Sauvignon Blanc and Chardonnay. Leyda, to the south, is closer to the sea and colder still.'],
    spots: [
      ['卡萨布兰卡', 'Casablanca', -33.321, -71.410], ['莱达', 'Leyda', -33.613, -71.446], ['瓦尔帕莱索', 'Valparaíso', -33.046, -71.620, 1]
    ] },
  { id: 'maipo', name: ['迈坡谷', 'Maipo Valley'], country: 'CL', view: 'southam', lat: -33.66, lon: -70.63, glass: ['red'],
    climate: ['温暖的地中海气候，安第斯山夜风', 'Warm Mediterranean, cool Andes nights'],
    grapes: ['cabernet-sauvignon', 'carmenere', 'merlot'],
    text: ['圣地亚哥周边，是智利最古老的产区之一：19 世纪中叶起，富裕家族从法国引进波尔多品种。靠近安第斯山的上迈坡海拔较高，夜里冷空气从山上流下来，赤霞珠因此带着特别的薄荷和黑醋栗味。普恩特阿尔托一带出产活灵魂（Almaviva）和魔爵（Don Melchor）等智利名酒。',
           'Around Santiago, and among Chile’s oldest wine regions: from the mid-1800s wealthy families brought in Bordeaux grapes from France. In Alto Maipo, higher up against the Andes, cold air slides down at night and Cabernet Sauvignon takes on a distinctive mint and cassis. Puente Alto makes some of Chile’s most famous wines, among them Almaviva and Don Melchor.'],
    spots: [
      ['普恩特阿尔托', 'Puente Alto', -33.610, -70.575], ['皮尔克', 'Pirque', -33.635, -70.573], ['布因', 'Buin', -33.732, -70.742],
      ['圣地亚哥', 'Santiago', -33.438, -70.651, 1]
    ] },
  { id: 'colchagua', name: ['空加瓜谷', 'Colchagua Valley'], country: 'CL', view: 'southam', lat: -34.59, lon: -71.49, glass: ['red'],
    climate: ['温暖的地中海气候', 'Warm Mediterranean'],
    grapes: ['carmenere', 'cabernet-sauvignon', 'syrah', 'malbec'],
    text: ['圣地亚哥以南约 180 公里，属于拉佩尔谷，比迈坡更温暖，是智利佳美娜和浓郁红酒的重镇。阿帕尔塔三面环山、向南朝廷吉里里卡河敞开的马蹄形山谷尤其出名，蒙特斯（Montes）和拉博丝特（Lapostolle）的顶级酒都出自这里。圣克鲁斯镇是产区的中心。',
           'About 180 km south of Santiago, part of the Rapel Valley and warmer than Maipo, a stronghold of Carménère and full-bodied reds. The horseshoe of hills at Apalta, open to the south over the Tinguiririca river, is especially famous, the source of top wines from Montes and Lapostolle. The town of Santa Cruz is its centre.'],
    spots: [
      ['圣克鲁斯', 'Santa Cruz', -34.640, -71.366], ['阿帕尔塔', 'Apalta', -34.635, -71.323], ['洛洛尔', 'Lolol', -34.728, -71.644],
      ['马尔奇圭', 'Marchigüe', -34.367, -71.642]
    ] },
  { id: 'mendoza', name: ['门多萨', 'Mendoza'], country: 'AR', view: 'southam', lat: -33.35, lon: -68.97, glass: ['red'],
    climate: ['高海拔沙漠', 'High-altitude desert'],
    grapes: ['malbec', 'cabernet-sauvignon', 'chardonnay', ['特浓情', 'Torrontés']],
    text: ['安第斯山东麓的沙漠绿洲，年降雨只有约 200 毫米，靠安第斯山的雪水顺着古老的水渠灌溉，阿根廷大约七成的葡萄酒产自这里。葡萄园海拔 800–1500 米，强烈的日照和凉爽的夜晚让马尔贝克颜色深紫、果味浓郁又不失新鲜。路冉德库约是传统核心，海拔更高的优克谷是近年最受瞩目的地方。夏天的冰雹是最大的威胁，很多葡萄园都盖着防雹网。',
           'A desert oasis at the eastern foot of the Andes, with only about 200 mm of rain a year, watered by Andean snowmelt through old irrigation channels; roughly 70% of Argentina’s wine is made here. The vineyards lie 800 to 1,500 metres up, where strong sun and cool nights give Malbec deep purple colour and rich fruit that stays fresh. Luján de Cuyo is the traditional heart; the higher Uco Valley is where the excitement is now. Summer hail is the great threat, and many vineyards sit under hail nets.'],
    spots: [
      ['迈普', 'Maipú', -32.985, -68.788], ['路冉德库约', 'Luján de Cuyo', -33.036, -68.877], ['图蓬加托', 'Tupungato', -33.371, -69.147],
      ['图努扬', 'Tunuyán', -33.581, -69.015], ['圣卡洛斯', 'San Carlos', -33.771, -69.048], ['门多萨市', 'Mendoza (city)', -32.890, -68.845, 1]
    ] },
  { id: 'salta', name: ['萨尔塔', 'Salta'], country: 'AR', view: 'southam', lat: -25.70, lon: -66.10, glass: ['white'],
    climate: ['高原沙漠，日照极强', 'High desert, fierce sun'],
    grapes: [['特浓情', 'Torrontés'], 'malbec', 'cabernet-sauvignon', ['丹娜', 'Tannat']],
    text: ['阿根廷西北部的卡尔查奇山谷，纬度只有南纬 25° 左右，本来太热，但葡萄园海拔 1700–3000 米，是世界上最高的葡萄园之一。日照强烈、昼夜温差极大，葡萄的皮又厚又深。招牌是芳香的白葡萄特浓情，闻起来像玫瑰和荔枝，喝起来却是干的；这里的马尔贝克和丹娜也很浓郁。卡法亚特是中心小镇。',
           'The Calchaquí valleys of north-west Argentina, at only about 25° south, too hot in principle, but the vineyards sit 1,700 to 3,000 metres up, among the highest in the world. The sun is fierce and the nights cold, so the grapes grow thick, dark skins. Its signature is the aromatic white Torrontés, which smells of roses and lychee yet is dry; its Malbec and Tannat are dense. Cafayate is the hub.'],
    spots: [
      ['卡奇', 'Cachi', -25.120, -66.162], ['莫利诺斯', 'Molinos', -25.443, -66.307], ['卡法亚特', 'Cafayate', -26.073, -65.976]
    ] },

  /* South Africa */
  { id: 'stellenbosch', name: ['斯泰伦博斯', 'Stellenbosch'], country: 'ZA', view: 'cape', lat: -33.92, lon: 18.90, glass: ['red'],
    climate: ['地中海气候，福尔斯湾海风', 'Mediterranean, False Bay breezes'],
    grapes: ['cabernet-sauvignon', 'pinotage', 'chenin-blanc', 'syrah', 'merlot'],
    text: ['开普敦以东约 50 公里，1679 年建镇，是南非第二古老的城镇和葡萄酒业的中心，斯泰伦博斯大学也是南非葡萄酒研究的重镇。花岗岩山（西蒙斯山、赫尔德山）的山坡和福尔斯湾吹来的凉风，让赤霞珠和波尔多式调配格外出色，皮诺塔吉也是在这里诞生的。附近还有弗朗斯胡克和帕尔。',
           'About 50 km east of Cape Town, founded in 1679, South Africa’s second-oldest town and the centre of its wine industry, with a university that leads the country’s wine research. Granite mountain slopes (Simonsberg, Helderberg) and cool breezes off False Bay suit Cabernet and Bordeaux blends especially well, and Pinotage was born here. Franschhoek and Paarl are close by.'],
    spots: [
      ['斯泰伦博斯镇', 'Stellenbosch (town)', -33.934, 18.869], ['西蒙斯山', 'Simonsberg', -33.884, 18.927], ['赫尔德山', 'Helderberg', -34.082, 18.849],
      ['弗朗斯胡克', 'Franschhoek', -33.909, 19.119], ['帕尔', 'Paarl', -33.731, 18.964]
    ] },
  { id: 'swartland', name: ['斯瓦特兰', 'Swartland'], country: 'ZA', view: 'cape', lat: -33.41, lon: 18.67, glass: ['white', 'red'],
    climate: ['炎热干燥', 'Hot and dry'],
    grapes: ['chenin-blanc', 'syrah', 'grenache', 'mourvedre', ['神索', 'Cinsault']],
    text: ['开普敦以北的“黑土地”，得名于一种颜色发暗的本地灌木，原本是种麦子的地方。夏天炎热干燥，很多老藤不灌溉，以灌木式生长。2000 年代起，伊本·萨迪（Eben Sadie）等年轻酿酒师用这里的白诗南老藤和罗讷品种酿出自然而有张力的酒，掀起“斯瓦特兰革命”，这里成了南非最受关注的产区。',
           'The “black land” north of Cape Town, named for a dark native shrub, and once wheat country. Summers are hot and dry, and many old vines grow as unirrigated bush vines. From the 2000s young winemakers led by Eben Sadie made vivid, natural wines from its old-vine Chenin Blanc and Rhône grapes, the “Swartland Revolution”, and it became South Africa’s most talked-about region.'],
    spots: [
      ['里贝克-卡斯蒂尔', 'Riebeek-Kasteel', -33.385, 18.896], ['马姆斯伯里', 'Malmesbury', -33.460, 18.724]
    ] },
  { id: 'constantia', name: ['康斯坦提亚', 'Constantia'], country: 'ZA', view: 'cape', lat: -34.03, lon: 18.42, glass: ['amber'],
    climate: ['凉爽，两面受海洋影响', 'Cool, between two oceans'],
    grapes: ['muscat', 'sauvignon-blanc', 'semillon'],
    text: ['开普敦南郊、桌山背后，有南非最古老的葡萄酒庄园之一，1685 年由开普总督西蒙·范德斯泰尔（Simon van der Stel）建立；南非最早的葡萄酒是 1659 年范里贝克（Jan van Riebeeck）在开普敦酿出的。18、19 世纪，这里用麝香葡萄酿的甜酒 Vin de Constance 风靡欧洲宫廷，据说流放在圣赫勒拿岛的拿破仑每月都要喝。根瘤蚜之后它消失了约一百年，直到 1986 年才重新酿造。如今这里凉爽的山坡也出产出色的长相思。',
           'Behind Table Mountain on Cape Town’s southern edge lies one of South Africa’s oldest wine estates, founded in 1685 by the Cape governor Simon van der Stel; the Cape’s first wine had been made in Cape Town by Jan van Riebeeck in 1659. In the 18th and 19th centuries its sweet Muscat, Vin de Constance, was the toast of European courts; Napoleon, exiled on St Helena, is said to have drunk it every month. It disappeared for about a century after phylloxera and was revived only in 1986. Today its cool slopes also make fine Sauvignon Blanc.'],
    spots: [
      ['格鲁特康斯坦提亚', 'Groot Constantia', -34.030, 18.418], ['开普敦', 'Cape Town', -33.929, 18.417, 1]
    ] },

  /* Australia and New Zealand */
  { id: 'barossa', name: ['巴罗萨谷', 'Barossa Valley'], country: 'AU', view: 'oceania', lat: -34.55, lon: 139.00, glass: ['red'],
    climate: ['温暖干燥', 'Warm and dry'],
    grapes: ['syrah', 'grenache', 'mourvedre', 'cabernet-sauvignon', 'riesling', 'semillon'],
    text: ['阿德莱德东北约 60 公里，19 世纪 40 年代由逃避宗教迫害的西里西亚（今天大部分在波兰）路德宗移民开垦，至今保留着德国风味的面包店和教堂。气候温暖，以浓郁饱满的设拉子闻名。南澳严格的检疫让根瘤蚜从未到达，所以这里保存着世界上最古老的一批仍在结果的设拉子和歌海娜老藤。东边地势更高的伊顿谷出产雷司令。',
           'About 60 km north-east of Adelaide, settled in the 1840s by Lutherans from Silesia (now mostly Poland) escaping religious persecution, whose bakeries and churches still give it a German air. It is warm and known for rich, full-bodied Shiraz. Strict quarantine kept phylloxera out of South Australia, so the Barossa holds some of the oldest Shiraz and Grenache vines still bearing anywhere. The higher Eden Valley next door makes Riesling.'],
    spots: [
      ['努里乌帕', 'Nuriootpa', -34.469, 138.994], ['塔南达', 'Tanunda', -34.522, 138.960], ['林多克', 'Lyndoch', -34.601, 138.888],
      ['安格斯顿', 'Angaston', -34.503, 139.049], ['伊顿谷', 'Eden Valley', -34.667, 139.130], ['阿德莱德', 'Adelaide', -34.928, 138.600, 1]
    ] },
  { id: 'clare', name: ['克莱尔谷', 'Clare Valley'], country: 'AU', view: 'oceania', lat: -33.93, lon: 138.64, glass: ['white'],
    climate: ['大陆性气候，昼夜温差大', 'Continental, warm days and cold nights'],
    grapes: ['riesling', 'syrah', 'cabernet-sauvignon'],
    text: ['阿德莱德以北约 120 公里的高地山谷，白天温暖、夜里凉爽。这里的干型雷司令是澳大利亚的标杆：青柠和柠檬皮的味道，酸度锋利，陈年后出现吐司和蜂蜜香。2000 年，克莱尔谷的一批酿酒师集体改用螺旋盖封瓶，带动了澳大利亚和新西兰的螺旋盖浪潮。',
           'A high valley about 120 km north of Adelaide, warm by day and cool by night. Its dry Rieslings are Australia’s benchmark, with lime and lemon zest, razor acidity, and toast and honey with age. In 2000 a group of Clare winemakers switched together to screw caps, setting off the screw-cap wave across Australia and New Zealand.'],
    spots: [
      ['克莱尔', 'Clare', -33.833, 138.612], ['七山', 'Sevenhill', -33.891, 138.629], ['沃特维尔', 'Watervale', -33.963, 138.645], ['奥本', 'Auburn', -34.026, 138.686]
    ] },
  { id: 'coonawarra', name: ['库纳瓦拉', 'Coonawarra'], country: 'AU', view: 'oceania', lat: -37.33, lon: 140.84, glass: ['red'],
    climate: ['凉爽，受海洋影响', 'Cool, maritime'],
    grapes: ['cabernet-sauvignon', 'syrah', 'merlot'],
    text: ['南澳东南角一条只有一两公里宽的狭长地带，地表是红色的 terra rossa 土，下面是白色石灰岩，排水好又能保水。气候凉爽，这里的赤霞珠带有标志性的黑醋栗和薄荷味，是澳大利亚最好的赤霞珠之一。',
           'A narrow strip in the far south-east of South Australia, only a kilometre or two wide, of red terra rossa soil over white limestone that drains well yet holds water. The climate is cool, and its Cabernet Sauvignon, with signature cassis and mint, is among Australia’s finest.'],
    spots: [
      ['库纳瓦拉镇', 'Coonawarra (township)', -37.291, 140.835], ['佩诺拉', 'Penola', -37.376, 140.840]
    ] },
  { id: 'hunter', name: ['猎人谷', 'Hunter Valley'], country: 'AU', view: 'oceania', lat: -32.78, lon: 151.25, glass: ['white'],
    climate: ['温暖潮湿', 'Warm and humid'],
    grapes: ['semillon', 'syrah', 'chardonnay'],
    text: ['悉尼以北约两小时车程，是澳大利亚最早的葡萄酒产区之一，19 世纪 20 年代就开始种植。气候湿热，采收季常遇雨，却出产独一无二的猎人谷赛美蓉：早采、不过桶、酒精只有 10%–11%，年轻时清淡，陈年十年以上会变成金黄色，带吐司、蜂蜜和坚果香。这里中等酒体、带泥土气息的设拉子也很有特色。',
           'About two hours’ drive north of Sydney, one of Australia’s earliest wine regions, planted from the 1820s. It is hot and humid, often with rain at harvest, yet it makes a wine found nowhere else, Hunter Semillon: picked early, unoaked and only 10–11% alcohol, lean when young, and after ten years or more golden, with toast, honey and nuts. Its medium-bodied, earthy Shiraz is distinctive too.'],
    spots: [
      ['波高尔宾', 'Pokolbin', -32.779, 151.298], ['塞斯诺克', 'Cessnock', -32.832, 151.351], ['布罗克', 'Broke', -32.748, 151.102],
      ['上猎人谷', 'Upper Hunter', -32.390, 150.688], ['悉尼', 'Sydney', -33.870, 151.208, 1]
    ] },
  { id: 'margaret-river', name: ['玛格丽特河', 'Margaret River'], country: 'AU', view: 'oceania', lat: -33.85, lon: 115.07, glass: ['red', 'white'],
    climate: ['温和的海洋性气候', 'Mild, maritime'],
    grapes: ['cabernet-sauvignon', 'chardonnay', 'semillon', 'sauvignon-blanc', 'merlot'],
    text: ['西澳西南角伸进印度洋的一片海岬，西、南两面临海，气候温和稳定，年份差异小。1960 年代的研究认为它的气候和波尔多相近，1967 年瓦斯·菲利斯（Vasse Felix）种下了第一批葡萄。如今以优雅的赤霞珠和霞多丽著称，露纹酒庄（Leeuwin Estate）的“艺术系列”霞多丽是澳大利亚最有名的白葡萄酒之一。',
           'A cape in Western Australia’s south-west corner, with the Indian Ocean to the west and south and a mild, steady climate that varies little from year to year. Studies in the 1960s found its climate close to Bordeaux’s, and Vasse Felix planted the first vines in 1967. It is now known for elegant Cabernet and Chardonnay; Leeuwin Estate’s Art Series Chardonnay is among Australia’s most famous whites.'],
    spots: [
      ['雅林古普', 'Yallingup', -33.640, 115.026], ['维亚布鲁普', 'Wilyabrup', -33.795, 115.046], ['科瓦拉穆普', 'Cowaramup', -33.851, 115.103],
      ['玛格丽特河镇', 'Margaret River (town)', -33.953, 115.077], ['威奇克利夫', 'Witchcliffe', -34.026, 115.100]
    ] },
  { id: 'yarra', name: ['雅拉谷', 'Yarra Valley'], country: 'AU', view: 'oceania', lat: -37.70, lon: 145.49, glass: ['red', 'white'],
    climate: ['凉爽', 'Cool'],
    grapes: ['pinot-noir', 'chardonnay', 'syrah', 'cabernet-sauvignon'],
    text: ['墨尔本东北约一小时车程，是维多利亚州最早的产区，1838 年就种下了葡萄。气候凉爽，以优雅的黑皮诺、霞多丽和起泡酒著称，酩悦香槟在这里建了夏桐酒庄（Domaine Chandon）。',
           'About an hour north-east of Melbourne and Victoria’s first wine region, planted in 1838. It is cool and known for elegant Pinot Noir, Chardonnay and sparkling wine; Moët & Chandon set up Domaine Chandon here.'],
    spots: [
      ['雅拉格伦', 'Yarra Glen', -37.657, 145.374], ['科尔德斯特里姆', 'Coldstream', -37.729, 145.378], ['希尔斯维尔', 'Healesville', -37.654, 145.516],
      ['上雅拉', 'Upper Yarra', -37.754, 145.689], ['墨尔本', 'Melbourne', -37.814, 144.963, 1]
    ] },
  { id: 'marlborough', name: ['马尔堡', 'Marlborough'], country: 'NZ', view: 'oceania', lat: -41.56, lon: 173.95, glass: ['white'],
    climate: ['日照充足，夜晚凉爽', 'Sunny days, cool nights'],
    grapes: ['sauvignon-blanc', 'pinot-noir', 'chardonnay', 'riesling', 'pinot-gris'],
    text: ['新西兰南岛的东北角，是全国最大的产区，约占新西兰葡萄园的三分之二。阳光充足、夜晚凉爽、生长季长，长相思带有强烈的百香果、西柚和青草香；1985 年云雾之湾（Cloudy Bay）的第一个年份让它一举闻名世界。怀劳谷是主体，南边的阿瓦特雷谷地势更高、更冷。',
           'The north-eastern corner of New Zealand’s South Island and the country’s largest region, with about two-thirds of its vineyards. Sunny days, cool nights and a long season give its Sauvignon Blanc intense passion fruit, grapefruit and cut grass, and Cloudy Bay’s first vintage, in 1985, made it world-famous. The Wairau Valley is the core; the Awatere, to the south, is higher and cooler.'],
    spots: [
      ['怀劳谷', 'Wairau Valley', -41.508, 173.829], ['布莱尼姆', 'Blenheim', -41.512, 173.955], ['阿瓦特雷谷', 'Awatere Valley', -41.671, 174.073]
    ] },
  { id: 'central-otago', name: ['中奥塔哥', 'Central Otago'], country: 'NZ', view: 'oceania', lat: -45.00, lon: 169.20, glass: ['red'],
    climate: ['新西兰唯一的大陆性气候', 'New Zealand’s only continental climate'],
    grapes: ['pinot-noir', 'pinot-gris', 'riesling', 'chardonnay'],
    text: ['南纬 45° 左右，是世界上最南端的葡萄酒产区之一，也是新西兰唯一的大陆性气候产区：被南阿尔卑斯山环绕，夏天炎热干燥，冬天严寒，昼夜温差大。这里是 1860 年代淘金热的中心，如今黑皮诺占葡萄园的七成以上，酒色深、果味纯净浓郁。班诺克本、吉布斯顿和班迪戈是主要的子产区。',
           'Near 45° south, among the world’s southernmost wine regions and New Zealand’s only one with a continental climate: ringed by the Southern Alps, with hot, dry summers, cold winters and cold nights. It was the heart of the 1860s gold rush; today Pinot Noir covers over 70% of its vineyards, deep in colour with pure, intense fruit. Bannockburn, Gibbston and Bendigo are among its sub-regions.'],
    spots: [
      ['瓦纳卡', 'Wanaka', -44.694, 169.136], ['吉布斯顿', 'Gibbston', -45.023, 168.955], ['克伦威尔', 'Cromwell', -45.037, 169.197],
      ['班诺克本', 'Bannockburn', -45.088, 169.160], ['班迪戈', 'Bendigo', -44.926, 169.344], ['亚历山德拉', 'Alexandra', -45.255, 169.392]
    ] },

  /* China */
  { id: 'ningxia', name: ['宁夏贺兰山东麓', 'Ningxia (Helan Mountains)'], country: 'CN', view: 'china', lat: 38.40, lon: 106.20, glass: ['red'],
    climate: ['干旱的大陆性气候', 'Arid, continental'],
    grapes: ['cabernet-sauvignon', 'marselan', 'merlot', 'chardonnay'],
    text: ['夹在贺兰山和黄河冲积平原之间，北纬 38° 左右，海拔 1100 米以上。贺兰山挡住了西北的寒风和风沙，黄河水用来灌溉；年降雨约 200 毫米，日照充足，昼夜温差大。冬天气温可低到 −20 °C，每年秋天葡萄藤都要压倒埋进土里越冬，春天再扒出来。2011 年，贺兰晴雪的“加贝兰 2009”在 Decanter 世界葡萄酒大赛上获得国际大奖，让宁夏进入世界视野；产区还参照波尔多建立了自己的列级酒庄制度。',
           'Between the Helan Mountains and the Yellow River plain, near 38° north and over 1,100 metres up. The mountains block the cold north-west winds and dust; the Yellow River supplies irrigation. Rain is about 200 mm a year, the sun is strong and the nights cold. Winters fall to −20 °C, so every autumn the vines are bent down and buried in earth, and dug out again in spring. In 2011 Helan Qingxue’s Jia Bei Lan 2009 won an International Trophy at the Decanter World Wine Awards and put Ningxia on the world’s map; the region has since set up its own classification of estates, modelled on Bordeaux.'],
    spots: [
      ['石嘴山', 'Shizuishan', 38.987, 106.377], ['贺兰', 'Helan', 38.554, 106.345], ['银川', 'Yinchuan', 38.487, 106.227, 1],
      ['永宁', 'Yongning', 38.277, 106.253], ['青铜峡', 'Qingtongxia', 38.021, 106.075], ['红寺堡', 'Hongsibao', 37.400, 106.100]
    ] },
  { id: 'shandong', name: ['山东胶东半岛', 'Shandong (Jiaodong)'], country: 'CN', view: 'china', lat: 37.60, lon: 121.00, glass: ['red'],
    climate: ['温带季风气候，受海洋影响', 'Monsoon, maritime'],
    grapes: ['cabernet-franc', 'carmenere', 'marselan', 'cabernet-sauvignon', ['小芒森', 'Petit Manseng'], ['贵人香', 'Welschriesling']],
    text: ['中国现代葡萄酒工业的发源地：1892 年，南洋华侨张弼士在烟台创办张裕酿酒公司。胶东半岛三面环海，气候温和，但夏秋雨水多、湿度大，病害是最大的挑战。传统品种有蛇龙珠（也就是佳美娜）和贵人香，近年烟台的品丽珠、小芒森和马瑟兰表现突出；拉菲的罗斯柴尔德家族也在蓬莱建了瓏岱酒庄。',
           'The birthplace of China’s modern wine industry: in 1892 the overseas Chinese merchant Zhang Bishi founded the Changyu winery in Yantai. The Jiaodong peninsula has the sea on three sides and a mild climate, but rainy, humid summers and autumns, so disease is the great challenge. Traditional grapes include Cabernet Gernischt (which is Carménère) and Welschriesling; lately Yantai’s Cabernet Franc, Petit Manseng and Marselan have stood out, and the Rothschilds of Lafite built Domaine de Long Dai at Penglai.'],
    spots: [
      ['蓬莱', 'Penglai', 37.810, 120.760], ['烟台', 'Yantai', 37.462, 121.443], ['青岛', 'Qingdao', 36.066, 120.378]
    ] },
  { id: 'xinjiang', name: ['新疆', 'Xinjiang'], country: 'CN', view: 'china', lat: 43.00, lon: 86.50, glass: ['red'],
    climate: ['极端的大陆性干旱气候', 'Extreme continental desert'],
    grapes: ['cabernet-sauvignon', 'merlot', 'marselan', 'syrah', 'chardonnay'],
    text: ['新疆的葡萄种植面积居全国首位，但大部分是吐鲁番等地的鲜食和制干葡萄。酿酒葡萄主要在天山北麓（玛纳斯、石河子一带）和南边的焉耆盆地：远离海洋，夏季干热、阳光强烈，昼夜温差常超过 15 °C，冬天极冷，葡萄同样要埋土越冬。焉耆盆地近年涌现出一批精品酒庄。',
           'Xinjiang grows more grapes than any other province in China, though most are table and raisin grapes from places like Turpan. Wine grapes grow mainly on the northern foothills of the Tian Shan, around Manas and Shihezi, and in the Yanqi basin to the south: far from any ocean, with hot, dry, sunny summers, days often 15 °C warmer than nights, and winters so cold the vines must be buried. The Yanqi basin has lately given rise to a group of fine boutique estates.'],
    spots: [
      ['伊犁河谷', 'Ili Valley', 43.905, 81.275], ['天山北麓（玛纳斯）', 'Tian Shan north (Manas)', 44.304, 86.217], ['吐鲁番', 'Turpan', 42.947, 89.184],
      ['焉耆盆地', 'Yanqi Basin', 42.058, 86.572], ['乌鲁木齐', 'Ürümqi', 43.824, 87.614, 1]
    ] },
  { id: 'yunnan', name: ['云南香格里拉', 'Yunnan (Shangri-La)'], country: 'CN', view: 'china', lat: 28.00, lon: 99.30, glass: ['red'],
    climate: ['低纬度高海拔', 'Low latitude, high altitude'],
    grapes: ['cabernet-sauvignon', 'merlot', 'chardonnay', ['玫瑰蜜', 'Rose Honey']],
    text: ['北纬 28° 左右的横断山区，在澜沧江和金沙江的深谷里，葡萄园海拔 2000–2800 米，是世界上海拔最高的葡萄园之一。19 世纪后期，法国传教士在茨中等地建教堂、种葡萄酿弥撒酒，留下了“玫瑰蜜”等老品种。2013 年起，酩悦轩尼诗在梅里雪山脚下酿造的敖云（Ao Yun）把这里推向了世界。',
           'Near 28° north in the Hengduan Mountains, in the deep gorges of the Mekong and the Jinsha (the upper Yangtze), the vineyards sit 2,000 to 2,800 metres up, among the highest in the world. In the late 1800s French missionaries built churches at places like Cizhong and planted vines for Mass wine, leaving old varieties such as Rose Honey. Since 2013 Moët Hennessy’s Ao Yun, made below the Meili Snow Mountain, has made the area known worldwide.'],
    spots: [
      ['德钦', 'Deqin', 28.475, 98.918], ['茨中', 'Cizhong', 28.033, 98.906], ['香格里拉', 'Shangri-La', 27.826, 99.706],
      ['弥勒', 'Mile', 24.410, 103.414], ['昆明', 'Kunming', 25.040, 102.717, 1]
    ] },
  { id: 'hebei', name: ['河北怀来与昌黎', 'Hebei (Huailai, Changli)'], country: 'CN', view: 'china', lat: 40.35, lon: 115.60, glass: ['red'],
    climate: ['干燥多风，昼夜温差大', 'Dry and windy, cold nights'],
    grapes: ['cabernet-sauvignon', 'marselan', 'chardonnay', ['龙眼', 'Longyan']],
    text: ['紧挨北京的产区。西北的怀来盆地和北京的延庆连成一片，合称延怀河谷，夹在燕山和太行山余脉之间，桑干河、洋河流过，风大、干燥、昼夜温差大。1979 年，中国第一瓶干白在怀来沙城用本地古老的龙眼葡萄酿成；2001 年前后，马瑟兰也最先在这里的中法合作葡萄园试种。东边靠近渤海的昌黎是另一个老产区，以赤霞珠见长。',
           'Wine country on Beijing’s doorstep. To the north-west, the Huailai basin, which runs into Beijing’s Yanqing as the Yanhuai valley, lies between the Yan and Taihang ranges; crossed by the Sanggan and Yang rivers, it is windy and dry with cold nights. China’s first dry white wine was made at Shacheng, in Huailai, in 1979, from the old local Longyan grape, and around 2001 Marselan was first planted in China at the Sino-French vineyard here. Changli, to the east near the Bohai Sea, is another long-established area, best known for Cabernet Sauvignon.'],
    spots: [
      ['怀来', 'Huailai', 40.415, 115.518], ['昌黎', 'Changli', 39.704, 119.161], ['北京', 'Beijing', 39.906, 116.391, 1]
    ] }
]
};
