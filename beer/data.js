/* ---------------------------------------------------------------
 * The beer styles and hops behind 原麦汁 Original Gravity (beer/index.html)
 *  - Style numbers (original and final gravity, alcohol, bitterness,
 *    colour) are the ranges in the BJCP 2021 Beer Style Guidelines,
 *    by the category in `bjcp`. beer/check.mjs compares them with the
 *    BJCP's own data.
 *  - Hop numbers are the ranges published by each hop's breeder or by
 *    the growers and merchants of its country, listed in `src`. Crops
 *    vary year to year, so treat them as typical, not exact.
 *  - Every text is [Chinese, English].
 * No DOM here, so node can load it for testing.
 * --------------------------------------------------------------- */
var OGData = (function () {
  'use strict';

  /* Where a style comes from: the style filter's groups, in order */
  var REGIONS = [
    { key: 'de', name: ['德国与捷克', 'Germany & Czechia'] },
    { key: 'uk', name: ['英国与爱尔兰', 'Britain & Ireland'] },
    { key: 'be', name: ['比利时', 'Belgium'] },
    { key: 'us', name: ['美国与新世界', 'America & the New World'] }
  ];

  /* How it ferments */
  var FERMENTS = {
    lager: ['下面发酵 · 拉格', 'Bottom-fermented lager'],
    ale: ['上面发酵 · 艾尔', 'Top-fermented ale'],
    wild: ['混合菌种与自然发酵', 'Mixed and wild fermentation']
  };

  /* The glass each style is served in, with its inside profile in cm from the rim down:
     [depth, inner diameter], and how full it is poured (depth of the beer's surface) */
  var GLASSES = {
    pint:    { name: ['品脱杯', 'pint glass'],      fill: 1.6, foot: 0,   profile: [[0, 8.6], [1.6, 8.9], [3.2, 8.3], [15, 6.1]] },
    pilsner: { name: ['皮尔森杯', 'pilsner glass'], fill: 3.0, foot: 2.6, profile: [[0, 7.0], [4, 6.6], [12, 5.4], [18.5, 4.2], [20, 3.4]] },
    mug:     { name: ['啤酒杯', 'mug'],             fill: 2.2, foot: 0,   profile: [[0, 8.2], [13.5, 8.2], [14, 7.8]], handle: true },
    weizen:  { name: ['小麦杯', 'weizen glass'],    fill: 4.0, foot: 0,   profile: [[0, 7.0], [3, 7.6], [6, 7.3], [10, 6.2], [17, 5.0], [22, 4.6], [23, 4.0]] },
    stange:  { name: ['直筒杯', 'Stange'],          fill: 1.4, foot: 0,   profile: [[0, 5.2], [14, 5.2], [14.4, 4.8]] },
    tulip:   { name: ['郁金香杯', 'tulip glass'],   fill: 3.0, foot: 7.0, profile: [[0, 7.0], [1.8, 6.6], [5, 7.8], [8, 7.2], [10.5, 4.6], [11.6, 1.6]] },
    chalice: { name: ['圣杯', 'chalice'],           fill: 1.8, foot: 7.5, profile: [[0, 9.6], [3.4, 9.3], [5.6, 7.6], [7.0, 4.4], [7.6, 1.6]] },
    snifter: { name: ['白兰地杯', 'snifter'],       fill: 4.2, foot: 4.5, profile: [[0, 6.0], [2.5, 7.8], [5.5, 9.0], [8, 7.4], [9.6, 4.0], [10.2, 1.6]] },
    tumbler: { name: ['平底杯', 'tumbler'],         fill: 1.6, foot: 0,   profile: [[0, 7.6], [11, 7.0], [11.5, 6.6]] },
    bowl:    { name: ['碗形杯', 'bowl glass'],      fill: 1.6, foot: 6.0, profile: [[0, 11.4], [2.5, 11.2], [5, 9.2], [6.6, 5.6], [7.4, 1.6]] }
  };

  /* r: region, f: fermentation, bjcp: the category the numbers come from.
     og/fg: specific gravity, abv: % by volume, ibu: bitterness units, srm: colour.
     haze: 0 clear to 1 opaque, for the drawing only. glass, temp: how it is served (°C).
     steps: the grain, the mash, the boil, the fermentation and the conditioning. */
  var STYLES = [
    {
      id: 'czech-pils', r: 'de', f: 'lager', bjcp: '3B',
      n: ['捷克皮尔森', 'Czech Pilsner'], local: 'Český ležák',
      p: ['捷克 · 比尔森', 'Plzeň, Bohemia'], y: ['1842 年', '1842'],
      og: [1.044, 1.060], fg: [1.013, 1.017], abv: [4.2, 5.8], ibu: [30, 45], srm: [3.5, 6],
      glass: 'mug', temp: [6, 8], hops: ['saaz'],
      ex: ['Pilsner Urquell', 'Budějovický Budvar', 'Bernard světlý ležák 12°'],
      sum: ['1842 年，比尔森市民酒厂请来巴伐利亚酿酒师约瑟夫·格罗尔。他用英国人那样间接加热烘干的浅色麦芽、当地极软的水和萨兹酒花，酿出了第一杯金色的拉格。今天世界上大多数啤酒都是它的后代。苦味坚实却不扎口，麦芽甜润，比德式皮尔森更饱满。',
            'In 1842 the burghers’ brewery of Plzeň hired a Bavarian brewer, Josef Groll. With pale malt kilned the English way, by indirect heat, the town’s very soft water and Saaz hops, he made the first golden lager, and most of the world’s beer descends from it. Firmly bitter without biting, with sweet malt and more body than a German pils.'],
      steps: {
        malt: ['几乎全用摩拉维亚两棱大麦做的皮尔森麦芽，低温烘干，所以颜色很浅。',
               'Almost all pilsner malt from Moravian two-row barley, kilned cool so it stays pale.'],
        mash: ['传统上做两到三次煮出糖化（decoction）：舀出一部分醪液煮沸再倒回去，一步步升温，带出更深的麦香和一点颜色。比尔森的水几乎不含矿物质，大量酒花的苦味因此显得圆润。',
               'Traditionally a double or triple decoction: part of the mash is drawn off, boiled and returned, raising the temperature step by step and adding depth and a little colour. Plzeň’s water holds almost no minerals, which keeps a heavy dose of hops tasting soft.'],
        boil: ['萨兹酒花分三次左右加入，第一次最多，苦度 30–45 IBU。萨兹的 α 酸只有 3–4%，要用很多酒花才苦得起来，草本和香料般的香气也就跟着进来了。',
               'Saaz in about three additions, the first the largest, to 30–45 IBU. At 3–4% alpha acid it takes a lot of Saaz to get there, and its herbal, spicy aroma comes along.'],
        ferment: ['捷克拉格酵母在 8–10°C 发酵约两周。低温让酯香很少；一丝黄油般的双乙酰在捷克是允许的。',
                  'Czech lager yeast at 8–10 °C for about two weeks. The cold keeps esters down; a trace of buttery diacetyl is accepted in Czech examples.'],
        cond: ['在接近 0°C 的酒窖里贮藏几周（lager 来自德语 lagern，“储存”），让酵母沉降、味道变干净。捷克酒馆还卖不过滤、不杀菌的罐装生啤（tankové pivo）。',
               'Lagered near 0 °C for several weeks (lager is from the German lagern, to store) while the yeast settles and the flavour cleans up. Czech pubs also pour unfiltered, unpasteurised tank beer, tankové pivo.']
      }
    },
    {
      id: 'german-pils', r: 'de', f: 'lager', bjcp: '5D',
      n: ['德式皮尔森', 'German Pils'], local: 'Pils, Pilsener',
      p: ['德国', 'Germany'], y: ['1870 年代', '1870s'],
      og: [1.044, 1.050], fg: [1.008, 1.013], abv: [4.4, 5.2], ibu: [22, 40], srm: [2, 4],
      glass: 'pilsner', temp: [6, 8], hops: ['hallertau', 'tettnang', 'spalt', 'magnum'],
      ex: ['Jever Pilsener', 'Rothaus Pils', 'Trumer Pils'],
      sum: ['1870 年代德国人照着捷克皮尔森酿出自己的版本，换上更硬的水和德国本土的酒花。颜色更浅、更干、更脆，苦味收得利落，是大多数人心里“啤酒”的样子。',
            'German brewers adapted the Czech original in the 1870s to their harder water and their own hops. Paler, drier and crisper, with a clean bitter finish: what most people picture when they think of beer.'],
      steps: {
        malt: ['全部是德国皮尔森麦芽，有时加一点酸化麦芽来调低醪液的 pH。',
               'All German pilsner malt, sometimes with a little acidulated malt to bring the mash pH down.'],
        mash: ['多用分段升温糖化，在 62–65°C 停留较久。这个温度下 β-淀粉酶切出的可发酵麦芽糖最多，所以发酵度高、口感干。德国北部的水含硫酸盐，苦味更硬朗。',
               'Usually a step mash with a long rest at 62–65 °C, where beta-amylase makes the most fermentable maltose; hence a high attenuation and a dry beer. North German water carries some sulfate, which sharpens the bitterness.'],
        boil: ['先用马格努姆这类高 α 酸酒花打苦，煮沸末段再加哈拉道、泰特南、斯帕尔特等贵族酒花增香。',
               'Bittered with a high-alpha hop such as Magnum, then finished late in the boil with noble hops: Hallertau, Tettnang, Spalt.'],
        ferment: ['干净的德国拉格酵母，8–12°C。快结束时升温两天做“双乙酰休止”，让酵母把黄油味重新吃掉。',
                  'Clean German lager yeast at 8–12 °C, warmed for a couple of days near the end, the diacetyl rest, so the yeast takes the buttery note back up.'],
        cond: ['0°C 左右贮藏四周以上，过滤后清澈透亮，泡沫洁白持久。',
               'Lagered around 0 °C for four weeks or more and filtered brilliant, with a lasting white head.']
      }
    },
    {
      id: 'helles', r: 'de', f: 'lager', bjcp: '4A',
      n: ['慕尼黑清亮拉格', 'Munich Helles'], local: 'Helles',
      p: ['慕尼黑', 'Munich'], y: ['1894 年', '1894'],
      og: [1.044, 1.048], fg: [1.006, 1.012], abv: [4.7, 5.4], ibu: [16, 22], srm: [3, 5],
      glass: 'mug', temp: [6, 8], hops: ['hallertau'],
      ex: ['Augustiner Lagerbier Hell', 'Weihenstephaner Original Helles', 'Schönramer Hell'],
      sum: ['1894 年慕尼黑的斯巴腾酒厂推出它，用来对抗风靡一时的皮尔森。皮尔森以酒花为先，清亮拉格以麦芽为先：柔和的面包香，苦度只有皮尔森的一半左右，圆润好喝，适合一升的大杯。',
            'Spaten launched it in Munich in 1894 to answer the craze for pilsner. Where pilsner leads with hops, helles leads with soft, bready malt at about half the bitterness: round and easy, made for a one-litre mug.'],
      steps: {
        malt: ['德国皮尔森麦芽为主，有时加一点慕尼黑麦芽增加麦香。',
               'German pilsner malt, sometimes with a little Munich malt for more malt flavour.'],
        mash: ['慕尼黑的水偏硬、碳酸盐多，大量酒花在这种水里会苦得粗糙，这也是慕尼黑的浅色啤酒一直少放酒花的原因之一。传统用煮出糖化，现在多用分段升温，酿酒师还会用酸化麦芽或处理过的水把 pH 调下来。',
               'Munich’s hard, carbonate-rich water makes a big dose of hops taste coarse, one reason the city’s pale beer kept its hopping low. Decoction is traditional; most brewers now step-mash and bring the pH down with acidulated malt or treated water.'],
        boil: ['只用少量哈拉道等德国酒花，苦度 16–22 IBU，酒花香若有若无。',
               'A modest charge of Hallertau or other German hops, to 16–22 IBU; the hop aroma is a whisper.'],
        ferment: ['干净的拉格酵母 9–12°C 发酵，几乎没有酯香，也不能有硫味或双乙酰。',
                  'Clean lager yeast at 9–12 °C, with almost no esters and no sulfur or diacetyl.'],
        cond: ['低温贮藏几周，过滤澄清。要喝新鲜的：放久了麦香会变成湿纸板味。',
               'Lagered cold for several weeks and filtered clear. Drink it fresh: with age the malt turns to wet cardboard.']
      }
    },
    {
      id: 'marzen', r: 'de', f: 'lager', bjcp: '6A',
      n: ['三月啤酒', 'Märzen'], local: 'Märzen, Oktoberfestbier',
      p: ['慕尼黑 · 巴伐利亚', 'Munich, Bavaria'], y: ['1841 年', '1841'],
      og: [1.054, 1.060], fg: [1.010, 1.014], abv: [5.6, 6.3], ibu: [18, 24], srm: [8, 17],
      glass: 'mug', temp: [7, 10], hops: ['hallertau', 'tettnang'],
      ex: ['Paulaner Oktoberfest Märzen', 'Hacker-Pschorr Oktoberfest Märzen', 'Weltenburger Kloster Anno 1050'],
      sum: ['没有冰箱的年代，夏天发酵很容易坏，巴伐利亚从 1553 年起禁止在 4 月 23 日到 9 月 29 日之间酿酒。于是每年三月酿一批更浓的酒，存进用冰降温的地窖撑过夏天，秋天喝完腾出酒桶。琥珀色，烤面包般的麦香。现代版本源自斯巴腾 1841 年的琥珀拉格，1872 到 1990 年一直是慕尼黑啤酒节的用酒。',
            'Before refrigeration summer fermentations spoiled easily, and from 1553 Bavaria banned brewing between 23 April and 29 September. So a stronger beer was brewed in March, kept through the summer in ice-cooled cellars and finished in autumn to free the casks. Amber, with a toasted-bread maltiness. The modern style goes back to Spaten’s amber lager of 1841, and it was the Oktoberfest beer from 1872 to 1990.'],
      steps: {
        malt: ['以慕尼黑麦芽为主，配维也纳和皮尔森麦芽。慕尼黑麦芽烘焙温度更高，约 100°C，美拉德反应给它面包皮和烤坚果的味道。',
               'Mostly Munich malt with Vienna and pilsner. Munich malt is kilned hotter, to about 100 °C, and the Maillard reactions give it its bread-crust, toasted-nut flavour.'],
        mash: ['传统用煮出糖化：煮沸那一部分醪液时生成的类黑素，让颜色和麦香都更深。',
               'Decoction is traditional: boiling part of the mash makes melanoidins that deepen both the colour and the malt flavour.'],
        boil: ['德国贵族酒花，苦度 18–24 IBU，只为平衡麦芽的甜。',
               'German noble hops to 18–24 IBU, there only to balance the malt.'],
        ferment: ['拉格酵母 8–10°C 发酵。',
                  'Lager yeast at 8–10 °C.'],
        cond: ['长时间贮藏本来就是这种酒的意义：过去整个夏天，现在通常四到八周。1990 年以后，啤酒节帐篷里卖的是更浅的金色节日啤酒（Festbier）。',
               'Long lagering is the point of the style: once the whole summer, now usually four to eight weeks. Since 1990 the Oktoberfest tents have poured the paler, golden Festbier instead.']
      }
    },
    {
      id: 'schwarzbier', r: 'de', f: 'lager', bjcp: '8B',
      n: ['德式黑啤', 'Schwarzbier'], local: 'Schwarzbier',
      p: ['图林根 · 萨克森', 'Thuringia and Saxony'], y: null,
      og: [1.046, 1.052], fg: [1.010, 1.016], abv: [4.4, 5.4], ibu: [20, 35], srm: [19, 30],
      glass: 'pilsner', temp: [7, 9], hops: ['hallertau', 'tettnang'],
      ex: ['Köstritzer Schwarzbier', 'Kulmbacher Mönchshof Schwarzbier'],
      sum: ['看起来像世涛，喝起来像拉格：颜色近黑，烘焙味却很轻，没有焦苦，收口干净。来自德国东部的图林根和萨克森，两德统一后流行开来，日本的黑啤也是受它启发。',
            'It looks like a stout and drinks like a lager: nearly black, but with only a light roast, no burnt bitterness and a clean, dry finish. From Thuringia and Saxony in eastern Germany; it spread after reunification and inspired Japan’s black lagers.'],
      steps: {
        malt: ['慕尼黑和皮尔森麦芽打底，加少量去了壳的深色烘焙麦芽（如 Carafa Special）。烘焙麦芽的涩和焦苦大多在麦壳里，去掉麦壳，就只留下颜色和柔和的咖啡、巧克力味。',
               'Munich and pilsner malts with a small share of dehusked roasted malt such as Carafa Special. Most of a roasted malt’s acrid bite sits in the husk; take it off and what is left is colour and a soft coffee-and-chocolate note.'],
        mash: ['简单的浸出或分段糖化。有的酿酒师到洗糟时才加深色麦芽，让涩味更少。',
               'A simple infusion or step mash; some brewers add the dark malt only at the end, while sparging, to keep astringency lower still.'],
        boil: ['德国酒花，苦度 20–35 IBU，比看上去苦一些。',
               'German hops to 20–35 IBU: more bitter than it looks.'],
        ferment: ['干净的拉格酵母，9–12°C。',
                  'Clean lager yeast at 9–12 °C.'],
        cond: ['低温贮藏几周，酒体清澈，泡沫是棕褐色的。',
               'Lagered cold for weeks; clear, under a tan head.']
      }
    },
    {
      id: 'doppelbock', r: 'de', f: 'lager', bjcp: '9A',
      n: ['双料博克', 'Doppelbock'], local: 'Doppelbock',
      p: ['慕尼黑', 'Munich'], y: ['18 世纪', '1700s'],
      og: [1.072, 1.112], fg: [1.016, 1.024], abv: [7, 10], ibu: [16, 26], srm: [6, 25],
      glass: 'tulip', temp: [9, 12], hops: ['hallertau'],
      ex: ['Paulaner Salvator', 'Ayinger Celebrator', 'Weihenstephaner Korbinian'],
      sum: ['慕尼黑圣方济各·保拉修会的修士为四旬期斋戒酿的“液体面包”：斋戒期不吃固体食物，就靠浓郁的麦芽酒撑过去。保拉纳的 Salvator（“救世主”）太出名，19 世纪法院判定这个名字归它独有，别家只好给自己的双料博克起 -ator 结尾的名字。',
            '“Liquid bread” brewed by the friars of St Francis of Paula in Munich to carry them through the Lenten fast, when solid food was off the table. Their Salvator (“saviour”) grew so famous that a 19th-century court reserved the name for them, and other brewers gave their doppelbocks names ending in -ator.'],
      steps: {
        malt: ['大量慕尼黑和维也纳麦芽，原麦汁浓度高达 18–26°P。深色版本有时加一点焦香麦芽或深色麦芽调色。',
               'A great deal of Munich and Vienna malt, for an original gravity of 18–26 °P; dark versions may add a touch of caramel or dark malt for colour.'],
        mash: ['传统用煮出糖化，带出浓重的面包、太妃糖和类黑素风味。糖化温度偏高，留下较多不可发酵的糊精，酒体厚实微甜。',
               'Decoction is traditional, for deep bread, toffee and melanoidin flavours. Warm saccharification rests leave more unfermentable dextrins: a full, slightly sweet body.'],
        boil: ['长时间煮沸让麦汁浓缩、焦糖化。酒花只用来平衡，16–26 IBU。',
               'A long boil concentrates and caramelises the wort. Hops are only for balance, 16–26 IBU.'],
        ferment: ['下面发酵，酵母投得多，8–10°C 慢慢发酵到 7–10% 的酒精度。',
                  'Bottom-fermented with a big pitch of yeast, slowly at 8–10 °C, to 7–10% alcohol.'],
        cond: ['低温贮藏一到三个月。把它冻起来、捞走冰，就是更浓的冰博克（Eisbock），酒精度 9–14%。',
               'Lagered one to three months. Freeze it and lift out the ice and you have eisbock, at 9–14% alcohol.']
      }
    },
    {
      id: 'rauchbier', r: 'de', f: 'lager', bjcp: '6B',
      n: ['烟熏啤酒', 'Rauchbier'], local: 'Rauchbier',
      p: ['班贝格 · 弗兰肯', 'Bamberg, Franconia'], y: null,
      og: [1.050, 1.057], fg: [1.012, 1.016], abv: [4.8, 6.0], ibu: [20, 30], srm: [12, 22],
      glass: 'mug', temp: [8, 10], hops: ['hallertau'],
      ex: ['Aecht Schlenkerla Rauchbier Märzen', 'Spezial Rauchbier Märzen'],
      sum: ['在间接加热的烘炉普及以前，麦芽是靠火烘干的，很多啤酒都带一点烟味。后来别处都改了，弗兰肯的班贝格却一直用山毛榉木的烟熏麦芽。闻起来像烟熏火腿和篝火，底子其实是一杯三月啤酒。',
            'Before indirect kilns, malt was dried over the fire and a lot of beer tasted a little of smoke. Everyone else moved on; Bamberg in Franconia kept smoking its malt over beechwood. It smells of smoked ham and campfire, over what is really a Märzen.'],
      steps: {
        malt: ['三月啤酒式的麦芽配方，其中一大部分是在山毛榉木烟里烘干的烟熏麦芽（Rauchmalz）。老字号 Schlenkerla 至今自己熏麦芽。',
               'A Märzen grist with a large share of Rauchmalz, malt dried in beechwood smoke. Schlenkerla still smokes its own.'],
        mash: ['煮出糖化，和三月啤酒一样，要浓郁的麦芽底子托住烟味。',
               'Decoction, as for a Märzen, for a rich malt base under the smoke.'],
        boil: ['德国酒花，20–30 IBU，酒花香不明显。',
               'German hops to 20–30 IBU, with little hop aroma.'],
        ferment: ['拉格酵母低温发酵。',
                  'Lager yeast, fermented cold.'],
        cond: ['低温贮藏。在 Schlenkerla 老城的酒馆里，酒直接从木桶里放出来。',
               'Lagered cold. At Schlenkerla’s tavern in the old town it still runs straight from wooden casks.']
      }
    },
    {
      id: 'kolsch', r: 'de', f: 'ale', bjcp: '5B',
      n: ['科隆啤酒', 'Kölsch'], local: 'Kölsch',
      p: ['科隆', 'Cologne'], y: ['19 世纪末', 'late 1800s'],
      og: [1.044, 1.050], fg: [1.007, 1.011], abv: [4.4, 5.2], ibu: [18, 30], srm: [3.5, 5],
      glass: 'stange', temp: [6, 8], hops: ['hallertau', 'tettnang', 'spalt'],
      ex: ['Früh Kölsch', 'Reissdorf Kölsch', 'Gaffel Kölsch'],
      sum: ['看起来像浅色拉格，其实是艾尔。科隆一直坚持上面发酵，城里甚至一度禁止下面发酵，于是酿酒师用艾尔酵母低温发酵，再像拉格那样冷藏。1986 年的《科隆公约》规定只有科隆一带酿的才能叫 Kölsch，用 0.2 升的细长直筒杯（Stange）喝。',
            'It looks like a pale lager but it is an ale. Cologne held to top fermentation, and bottom fermentation was once banned in the city, so its brewers ferment ale yeast cool and then lager the beer cold. Since the Kölsch Konvention of 1986 only beer from in and around Cologne may use the name; it comes in a slim 0.2-litre Stange.'],
      steps: {
        malt: ['德国皮尔森麦芽，有时加少量小麦麦芽。',
               'German pilsner malt, sometimes with a little wheat malt.'],
        mash: ['分段升温糖化，追求高发酵度和干爽的收口。',
               'A step mash aimed at high attenuation and a dry finish.'],
        boil: ['德国传统酒花，18–30 IBU。',
               'German hops, 18–30 IBU.'],
        ferment: ['关键一步：上面发酵的科隆酵母在约 15°C 工作，比一般艾尔冷，只留一点梨子和白葡萄般的果香。',
                  'The defining step: Cologne’s top-fermenting yeast works at about 15 °C, colder than most ales, leaving just a hint of pear and white grape.'],
        cond: ['接近 0°C 冷藏，最长一个月，喝起来和拉格一样干净。在科隆的酒馆里，服务员（Köbes）端着圆托盘一杯接一杯地送，直到你把杯垫盖在杯口上。',
               'Cold-conditioned near 0 °C for up to a month, so it drinks as clean as a lager. In Cologne’s taverns the waiters, the Köbes, keep bringing fresh glasses until you lay your beer mat on top of yours.']
      }
    },
    {
      id: 'hefeweizen', r: 'de', f: 'ale', bjcp: '10A',
      n: ['德式小麦', 'Hefeweizen'], local: 'Hefeweißbier',
      p: ['巴伐利亚', 'Bavaria'], y: ['1872 年', '1872'],
      og: [1.044, 1.053], fg: [1.008, 1.014], abv: [4.3, 5.6], ibu: [8, 15], srm: [2, 6], haze: 0.7,
      glass: 'weizen', temp: [6, 8], hops: ['hallertau'],
      ex: ['Weihenstephaner Hefeweissbier', 'Ayinger Bräuweisse', 'Schneider Weisse Original'],
      sum: ['巴伐利亚的小麦啤酒，曾经由王室专营，1872 年施奈德买下酿造权后才走进民间。它的性格来自酵母：上面发酵的小麦啤酒酵母同时产生乙酸异戊酯（香蕉味）和 4-乙烯基愈创木酚（丁香味）。浑浊、气足、泡沫高耸，用半升的高身花瓶杯。',
            'Bavaria’s wheat beer, once a royal monopoly, reached everyone else after Schneider bought the right to brew it in 1872. Its character is the yeast’s: a top-fermenting weizen strain that makes isoamyl acetate (banana) and 4-vinyl guaiacol (clove). Cloudy, lively and under a towering head, in a tall half-litre vase.'],
      steps: {
        malt: ['至少一半是小麦麦芽，通常 50–70%，其余是皮尔森麦芽。小麦没有麦壳、蛋白质多，带来泡沫和浑浊。',
               'At least half wheat malt, usually 50–70%, the rest pilsner malt. Wheat has no husk and plenty of protein: foam and haze.'],
        mash: ['传统用煮出糖化。很多酒厂先在约 45°C 停留，释放阿魏酸，酵母随后把它变成丁香味的 4-乙烯基愈创木酚。小麦没有壳，过滤靠大麦的麦壳帮忙。',
               'Decoction is traditional. Many brewers first rest at about 45 °C to free ferulic acid, which the yeast later turns into clove-scented 4-vinyl guaiacol. Husk-less wheat filters slowly; the barley’s husks do the work.'],
        boil: ['酒花极少，8–15 IBU，几乎尝不出来。',
               'Very few hops, 8–15 IBU; barely there.'],
        ferment: ['小麦啤酒酵母 17–22°C 上面发酵，传统用敞口发酵槽。温度高一些、酵母投得少一些，香蕉味多；温度低一些，丁香味更突出。',
                  'Weizen yeast, top-fermenting at 17–22 °C, traditionally in open vessels. Warmer and with less yeast pitched the beer leans to banana; cooler, to clove.'],
        cond: ['不过滤（Hefe 就是“酵母”），装瓶时加新鲜麦汁或酵母在瓶中再发酵，气泡量接近普通啤酒的两倍。倒到最后摇一摇瓶底，把酵母也倒进杯里。',
               'Left unfiltered (Hefe is yeast) and refermented in the bottle with fresh wort or yeast, to nearly twice the carbonation of most beers. Swirl the last of the bottle to pour the yeast in too.']
      }
    },
    {
      id: 'berliner', r: 'de', f: 'wild', bjcp: '23A',
      n: ['柏林白啤', 'Berliner Weisse'], local: 'Berliner Weiße',
      p: ['柏林', 'Berlin'], y: ['1809 年已闻名', 'famous by 1809'],
      og: [1.028, 1.032], fg: [1.003, 1.006], abv: [2.8, 3.8], ibu: [3, 8], srm: [2, 3], haze: 0.25,
      glass: 'bowl', temp: [4, 6], hops: ['hallertau'],
      ex: ['Berliner Berg Berliner Weisse', 'Bayerischer Bahnhof Berliner Style Weisse'],
      sum: ['柏林的低度酸小麦啤酒，1809 年拿破仑的士兵叫它“北方的香槟”。乳酸菌带来清爽的酸，酒精度只有 3% 左右。柏林人常加覆盆子或车叶草糖浆，插根吸管喝。',
            'Berlin’s low-alcohol sour wheat beer, called “the Champagne of the North” by Napoleon’s troops in 1809. Lactic acid bacteria make it tart, at only about 3% alcohol. Berliners often add raspberry or woodruff syrup and drink it through a straw.'],
      steps: {
        malt: ['小麦麦芽和皮尔森麦芽，通常小麦占一半以上。',
               'Wheat and pilsner malt, usually at least half wheat.'],
        mash: ['传统上把酒花放进糖化锅里（mash hopping），麦汁只稍微煮一下甚至不煮，好让乳酸菌活下来。现在很多人改用“锅内酸化”：先让乳酸菌把麦汁变酸，再煮沸杀菌，之后才加酵母。',
               'Traditionally the hops went into the mash and the wort was boiled briefly or not at all, so the lactic bacteria survived. Many brewers now kettle-sour instead: lactobacillus sours the wort first, then a boil kills it before the yeast goes in.'],
        boil: ['酒花只是象征，3–8 IBU。酒花会抑制乳酸菌，所以一定要少。',
               'Hops are a token, 3–8 IBU: they inhibit lactic bacteria, so they must stay low.'],
        ferment: ['上面发酵酵母和乳酸菌一起发酵，传统上还有酒香酵母（Brettanomyces）带来花果香。',
                  'Top-fermenting yeast and lactobacillus together, traditionally with Brettanomyces adding a fruity, floral note.'],
        cond: ['瓶中熟成，能放好几年，越放越复杂。',
               'Bottle-conditioned; it keeps for years and grows more complex.']
      }
    },
    {
      id: 'best-bitter', r: 'uk', f: 'ale', bjcp: '11B',
      n: ['英式苦啤', 'Best Bitter'], local: 'Bitter',
      p: ['英格兰', 'England'], y: ['19 世纪', '1800s'],
      og: [1.040, 1.048], fg: [1.008, 1.012], abv: [3.8, 4.6], ibu: [25, 40], srm: [8, 16],
      glass: 'pint', temp: [11, 13], hops: ['ekg', 'fuggle'],
      ex: ['Fuller’s London Pride', 'Timothy Taylor Landlord', 'Harvey’s Sussex Best Bitter'],
      sum: ['英国酒吧里的日常啤酒，传统上是“真艾尔”（real ale）：在酒桶里完成最后的发酵，不过滤，不另外充气，在酒窖的温度下用手压的啤酒泵抽上来。酒精度不高，苦味、麦香和英式酵母的果香恰到好处，适合一品脱接一品脱地喝。',
            'The everyday beer of the English pub, traditionally real ale: it finishes conditioning in the cask, unfiltered and with no added gas, and is pulled up from the cellar by hand pump at cellar temperature. Modest in strength, with bitterness, malt and the fruit of English yeast in balance: a beer for one pint after another.'],
      steps: {
        malt: ['英式淡色艾尔麦芽（如 Maris Otter）为主，加 5–10% 焦香（水晶）麦芽带来太妃糖味和琥珀色，常加一点糖。',
               'English pale ale malt such as Maris Otter, with 5–10% crystal malt for toffee and an amber colour, and often a little sugar.'],
        mash: ['单次浸出，约 65–67°C 停留一小时。传统英国糖化锅同时是过滤槽，所以不做分段升温。伯顿（Burton）的水富含石膏（硫酸钙），苦味干脆。',
               'A single infusion at about 65–67 °C for an hour; the traditional British mash tun doubles as the lauter tun, so there are no temperature steps. Burton’s gypsum-rich water, high in calcium sulfate, makes the bitterness crisp.'],
        boil: ['东肯特哥尔丁、法格尔等英国酒花，25–40 IBU：泥土、花香和橘子酱般的香气。',
               'English hops such as East Kent Goldings and Fuggle, 25–40 IBU: earthy, floral, marmalade-like.'],
        ferment: ['英式艾尔酵母 18–20°C，带红苹果和梨子般的酯香，有的菌株留一点黄油太妃糖般的双乙酰。',
                  'English ale yeast at 18–20 °C, with esters of red apple and pear; some strains leave a little butterscotch diacetyl.'],
        cond: ['连同一些酵母装进酒桶，常加鱼胶澄清剂和少量糖，在酒吧地窖里二次发酵一到三天才开卖，开桶后几天内就要喝完。12°C 左右侍酒，气泡很少。',
               'Racked to casks with some yeast, often with isinglass finings and a little priming sugar, it conditions in the pub cellar for one to three days before serving and must be drunk within a few days of tapping. Served at about 12 °C, softly carbonated.']
      }
    },
    {
      id: 'english-ipa', r: 'uk', f: 'ale', bjcp: '12C',
      n: ['英式 IPA', 'English IPA'], local: 'India Pale Ale',
      p: ['伦敦 · 伯顿', 'London and Burton upon Trent'], y: ['18 世纪末', 'late 1700s'],
      og: [1.050, 1.070], fg: [1.010, 1.015], abv: [5, 7.5], ibu: [40, 60], srm: [6, 14],
      glass: 'pint', temp: [10, 12], hops: ['ekg', 'fuggle'],
      ex: ['Worthington White Shield', 'Fuller’s Bengal Lancer', 'Thornbridge Jaipur'],
      sum: ['18 世纪末，伦敦的淡色窖藏艾尔开始被运往印度，大量的酒花帮它熬过几个月的航行。1823 年伯顿的奥尔索普用当地富含硫酸盐的硬水重新酿造，苦味更干净利落，伯顿从此成了 IPA 的故乡。“印度淡色艾尔”这个名字到 1830 年前后才出现。',
            'From the late 1700s London’s pale stock ales were shipped to India, their heavy hopping helping them through months at sea. In 1823 Samuel Allsopp of Burton re-created the beer with the town’s sulfate-rich water, which made the bitterness cleaner, and Burton became the home of IPA; the name India pale ale appeared only around 1830.'],
      steps: {
        malt: ['英式淡色艾尔麦芽，少量焦香麦芽，有时加糖让酒更干。',
               'English pale ale malt with a little crystal, and sometimes sugar to dry the beer out.'],
        mash: ['单次浸出糖化。伯顿的井水含大量硫酸钙，有时带一丝硫磺味，叫“伯顿嗅”（Burton snatch）。别处的酿酒师往水里加石膏来模仿，称为“伯顿化”。',
               'A single infusion mash. Burton’s well water is loaded with calcium sulfate and can leave a whiff of sulfur, the “Burton snatch”; brewers elsewhere add gypsum to imitate it, Burtonising their water.'],
        boil: ['大量英国酒花，40–60 IBU，煮沸末段再加一次增香。',
               'Plenty of English hops to 40–60 IBU, with a late charge for aroma.'],
        ferment: ['发酵度高的英式艾尔酵母，18–20°C。',
                  'Attenuative English ale yeast at 18–20 °C.'],
        cond: ['历史上在木桶里熟成好几个月，桶里还会再放酒花；现代版本几周就好。',
               'Historically aged for months in wood, with more hops put into the cask; modern versions take a few weeks.']
      }
    },
    {
      id: 'porter', r: 'uk', f: 'ale', bjcp: '13C',
      n: ['英式波特', 'English Porter'], local: 'Porter',
      p: ['伦敦', 'London'], y: ['18 世纪初', 'early 1700s'],
      og: [1.040, 1.052], fg: [1.008, 1.014], abv: [4, 5.4], ibu: [18, 35], srm: [20, 30],
      glass: 'pint', temp: [10, 13], hops: ['fuggle', 'ekg'],
      ex: ['Fuller’s London Porter', 'Samuel Smith Taddy Porter'],
      sum: ['18 世纪初伦敦的棕色啤酒，因为码头和市场上的搬运工（porter）爱喝而得名。它是第一种工业化大规模酿造的啤酒，一个大酒槽能装几百吨。1817 年发明的黑麦芽让酿酒师可以改用便宜的淡色麦芽，只加一点黑麦芽调色。所有的世涛最初都叫“更烈的波特”（stout porter）。',
            'A brown beer of early-18th-century London, named for the porters of its docks and markets who drank it. It was the first beer brewed on an industrial scale, matured in vats holding hundreds of tons. Black malt, invented in 1817, let brewers switch to cheap pale malt with a little black for colour. Every stout began as a stronger “stout porter”.'],
      steps: {
        malt: ['传统上用木柴烘干的棕色麦芽（brown malt）；现在多用淡色麦芽，加棕色、巧克力和焦香麦芽。',
               'Traditionally brown malt, kilned over wood; today pale malt with brown, chocolate and crystal malts.'],
        mash: ['单次浸出糖化。深色麦芽带来巧克力、太妃糖和一点烘烤味，但不像世涛那样焦。',
               'A single infusion mash. The dark malts give chocolate, toffee and a light roast, short of a stout’s burnt edge.'],
        boil: ['英国酒花，18–35 IBU。',
               'English hops, 18–35 IBU.'],
        ferment: ['英式艾尔酵母。',
                  'English ale yeast.'],
        cond: ['18 世纪的波特要在大酒槽里陈一年以上，酒香酵母让它带上酸和皮革般的“陈味”，酒馆常把陈酒和新酒兑着卖。今天多是新鲜饮用。',
               'Eighteenth-century porter aged a year or more in great vats, where Brettanomyces gave it a sour, leathery “stale” note, and publicans blended old with fresh. Today it is mostly drunk young.']
      }
    },
    {
      id: 'irish-stout', r: 'uk', f: 'ale', bjcp: '15B',
      n: ['爱尔兰世涛', 'Irish Stout'], local: 'Dry stout',
      p: ['都柏林', 'Dublin'], y: ['19 世纪', '1800s'],
      og: [1.036, 1.044], fg: [1.007, 1.011], abv: [3.8, 5], ibu: [25, 45], srm: [25, 40],
      glass: 'pint', temp: [6, 8], hops: ['ekg', 'northern-brewer'],
      ex: ['Guinness Draught', 'Murphy’s Irish Stout', 'Beamish Irish Stout'],
      sum: ['从伦敦波特演变而来：健力士 1799 年起只酿波特，约 1810 年开始酿“更烈的波特”。爱尔兰世涛以未发芽的烤大麦为标志，有咖啡般的干苦，酒体却很轻，酒精度只有 4% 左右。1959 年起用氮气打酒，泡沫细腻得像奶油。',
            'A descendant of London porter: Guinness brewed only porter from 1799 and a “stouter” porter from about 1810. Irish stout is marked by roasted unmalted barley, with a dry, coffee-like bitterness on a light body at about 4% alcohol. Since 1959 it has been poured with nitrogen, for a head like whipped cream.'],
      steps: {
        malt: ['淡色麦芽为主，约 10% 烤大麦（没发芽的大麦直接烘烤到近黑）和片状大麦。烤大麦比黑麦芽更干、更像咖啡。',
               'Mostly pale malt, with about 10% roasted barley (unmalted barley roasted nearly black) and flaked barley. Roasted barley is drier and more like coffee than black malt.'],
        mash: ['单次浸出糖化。都柏林的水碳酸盐多，正好中和深色麦芽的酸。',
               'A single infusion mash. Dublin’s carbonate-rich water neutralises the acidity of the dark grain.'],
        boil: ['以打苦为主，25–45 IBU，几乎没有酒花香。',
               'Bittering hops to 25–45 IBU, with hardly any hop aroma.'],
        ferment: ['爱尔兰艾尔酵母，干净，略带果香。',
                  'Irish ale yeast, clean with a little fruit.'],
        cond: ['打酒时用大约三份氮气、一份二氧化碳的混合气。氮气几乎不溶于酒，冒出的气泡极细，形成奶油般的泡沫和瀑布般下沉的“涌浪”。1989 年健力士在罐里放了一个小塑料球（widget），开罐时喷出氮气，在家也能倒出同样的泡沫。',
               'Dispensed with roughly three parts nitrogen to one of carbon dioxide. Nitrogen barely dissolves, so the bubbles are tiny: a creamy head and the famous cascade. In 1989 Guinness put a plastic widget in its cans that releases nitrogen on opening, so the head works at home too.']
      }
    },
    {
      id: 'imperial-stout', r: 'uk', f: 'ale', bjcp: '20C',
      n: ['帝国世涛', 'Imperial Stout'], local: 'Russian imperial stout',
      p: ['伦敦，出口波罗的海', 'London, for the Baltic'], y: ['18 世纪', '1700s'],
      og: [1.075, 1.115], fg: [1.018, 1.030], abv: [8, 12], ibu: [50, 90], srm: [30, 40],
      glass: 'snifter', temp: [12, 15], hops: ['ekg', 'columbus', 'magnum'],
      ex: ['Samuel Smith Imperial Stout', 'North Coast Old Rasputin', 'Goose Island Bourbon County Brand Stout'],
      sum: ['18 世纪伦敦出口到波罗的海和俄国的最烈的世涛，据说深受俄国宫廷喜爱。黑得像墨水，有咖啡、黑巧克力、葡萄干和糖蜜的味道，酒精度 8–12%。现代美国版本常放进波本桶陈酿。',
            'The strongest stout of 18th-century London, brewed for export to the Baltic and Russia and said to be a favourite of the Russian court. Inky black, with coffee, dark chocolate, raisin and treacle, at 8–12% alcohol. Modern American versions often age in bourbon barrels.'],
      steps: {
        malt: ['大量淡色麦芽，配烤大麦和黑色、巧克力、焦香麦芽，常加片状燕麦或大麦。',
               'A great deal of pale malt with roasted barley and black, chocolate and crystal malts, often with flaked oats or barley.'],
        mash: ['麦芽多到糖化锅装满，常常只取最浓的头道麦汁，或延长煮沸把麦汁浓缩。',
               'So much grain the mash tun is full to the brim; brewers often take only the strong first runnings, or boil longer to concentrate the wort.'],
        boil: ['苦度 50–90 IBU，但大半被浓重的麦芽甜和烘烤苦盖住。',
               '50–90 IBU, much of it hidden behind the sweetness and the roast.'],
        ferment: ['需要大量健康的酵母和充足的氧气，还要控住温度，否则高浓度会产生溶剂味的杂醇。',
                  'It needs a big, healthy pitch of yeast, plenty of oxygen and a controlled temperature, or the high gravity throws solvent-like fusel alcohols.'],
        cond: ['熟成几个月到几年。1992 年鹅岛酒厂把世涛装进刚倒空的波本威士忌桶，开了桶陈的先河，酒里多了香草、椰子和烤橡木的味道。',
               'Aged months to years. In 1992 Goose Island filled freshly emptied bourbon barrels with stout and started the barrel-aged fashion: vanilla, coconut and toasted oak.']
      }
    },
    {
      id: 'barleywine', r: 'uk', f: 'ale', bjcp: '17D',
      n: ['英式大麦酒', 'English Barleywine'], local: 'Barley wine',
      p: ['英格兰 · 伯顿', 'Burton, England'], y: ['1872 年得名', 'named in 1872'],
      og: [1.080, 1.120], fg: [1.018, 1.030], abv: [8, 12], ibu: [35, 70], srm: [8, 22],
      glass: 'snifter', temp: [12, 16], hops: ['ekg', 'fuggle'],
      ex: ['J.W. Lees Harvest Ale', 'Fuller’s Golden Pride', 'Robinson’s Old Tom'],
      sum: ['在酒精度和陈年潜力上都向葡萄酒看齐的啤酒：1872 年，巴斯 1 号第一次被叫作“大麦酒”。据说英国和法国交战、喝不到波尔多的年代，乡绅们就拿最烈的麦芽酒当国产的“葡萄酒”。能在瓶里放几十年，慢慢变出雪莉酒、太妃糖和干果的味道。',
            'A beer that rivals wine in strength and in age-worthiness: Bass No. 1 was first called a barley wine in 1872. When wars with France kept claret off English tables, it is said, the gentry drank their strongest malt liquor in its place. It can age in bottle for decades, turning to sherry, toffee and dried fruit.'],
      steps: {
        malt: ['英式淡色麦芽为主，少量焦香麦芽，有时加糖。',
               'English pale malt with some crystal, and sometimes sugar.'],
        mash: ['传统做法是“分批取汁”（parti-gyle）：同一锅麦芽，最浓的头道麦汁酿大麦酒，后面较淡的洗糟麦汁酿普通艾尔。',
               'Traditionally parti-gyle: from one mash, the strong first runnings become the barley wine and the weaker later runnings an ordinary ale.'],
        boil: ['煮沸两三个小时，麦汁浓缩、焦糖化。英国酒花，35–70 IBU，陈年后苦味会慢慢退去。',
               'A boil of two or three hours concentrates and caramelises the wort. English hops, 35–70 IBU, which fade as the beer ages.'],
        ferment: ['高浓度发酵，常要补投酵母，或换一株发酵力更强的酵母收尾。',
                  'A high-gravity fermentation, often re-pitched or finished with a more attenuative strain.'],
        cond: ['熟成几个月到几年，最好的能在酒窖里放二三十年。可以像葡萄酒那样买一箱，每年开一瓶，看它怎么变。',
               'Matured for months or years; the best keep twenty or thirty years in a cellar. As with wine, buy a case and open a bottle each year to follow it.']
      }
    },
    {
      id: 'witbier', r: 'be', f: 'ale', bjcp: '24A',
      n: ['比利时白啤', 'Witbier'], local: 'Witbier, bière blanche',
      p: ['比利时 · 胡哈尔登', 'Hoegaarden, Belgium'], y: ['1966 年复活', 'revived in 1966'],
      og: [1.044, 1.052], fg: [1.008, 1.012], abv: [4.5, 5.5], ibu: [8, 20], srm: [2, 4], haze: 0.7,
      glass: 'tumbler', temp: [4, 7], hops: ['saaz', 'styrian'],
      ex: ['Hoegaarden', 'Allagash White', 'St. Bernardus Wit'],
      sum: ['鲁汶一带中世纪就有的白啤，1957 年最后一家酒厂关门后失传。1966 年，送牛奶的皮埃尔·塞利斯在自己的村子胡哈尔登把它复活。用未发芽的小麦，加芫荽籽和库拉索苦橙皮：浑浊、清爽，带柑橘和香料味。',
            'A white beer brewed around Leuven since the Middle Ages, lost when its last brewery closed in 1957. In 1966 Pierre Celis, a milkman, revived it in his village of Hoegaarden. Unmalted wheat, coriander seed and dried Curaçao orange peel: hazy and refreshing, citrusy and spicy.'],
      steps: {
        malt: ['30–60% 未发芽的小麦、5–10% 生燕麦，其余是颜色极浅的大麦麦芽。',
               '30–60% unmalted wheat and 5–10% raw oats, the rest very pale barley malt.'],
        mash: ['生小麦的淀粉要先糊化，常用分段升温或单独煮谷物。未发芽谷物的蛋白质让酒像牛奶一样浑浊，“白”就是这么来的。',
               'The raw wheat’s starch has to be gelatinised first, so a step mash or a separate cereal cook is common. The unmalted grain’s proteins give the milky haze that names it white.'],
        boil: ['酒花很少，8–20 IBU；煮沸最后几分钟加入碾碎的芫荽籽和苦橙皮。',
               'Few hops, 8–20 IBU; crushed coriander and orange peel go in for the last minutes of the boil.'],
        ferment: ['比利时白啤酵母 18–22°C，带一点胡椒般的酚和柑橘般的酯。',
                  'Belgian wit yeast at 18–22 °C, adding peppery phenols and citrus esters.'],
        cond: ['不过滤，常在瓶中再发酵，气泡活泼。要喝新鲜的。',
               'Unfiltered, often refermented in the bottle and lively. Drink it fresh.']
      }
    },
    {
      id: 'saison', r: 'be', f: 'ale', bjcp: '25B',
      n: ['赛松', 'Saison'], local: 'Saison',
      p: ['比利时 · 瓦隆', 'Wallonia, Belgium'], y: ['农家传统', 'a farmhouse tradition'],
      og: [1.048, 1.065], fg: [1.002, 1.008], abv: [5, 7], ibu: [20, 35], srm: [5, 14], haze: 0.2,
      glass: 'tulip', temp: [7, 10], hops: ['styrian', 'ekg', 'saaz', 'sorachi', 'nelson'],
      ex: ['Saison Dupont', 'Fantôme Saison', 'Brooklyn Sorachi Ace'],
      sum: ['比利时南部法语区瓦隆的农家啤酒：在凉快的月份酿好，留到农忙时给季节工（saisonniers）喝，所以原本酒精度不高。现代的标杆是 1920 年代开始酿的杜邦赛松。极干，气泡足，带胡椒、柑橘和农舍般的土香。',
            'A farmhouse beer of Wallonia, French-speaking southern Belgium: brewed in the cooler months and kept for the seasonal hands, the saisonniers, at harvest, so originally not strong. The modern benchmark is Saison Dupont, first brewed in the 1920s. Bone-dry and lively, peppery, citrusy and rustic.'],
      steps: {
        malt: ['皮尔森麦芽为主，常加小麦、斯佩尔特小麦、燕麦或黑麦，有时加糖。',
               'Mostly pilsner malt, often with wheat, spelt, oats or rye, and sometimes sugar.'],
        mash: ['较低的糖化温度，再加上酵母本身惊人的胃口，残糖几乎为零。',
               'A low mash temperature, and a yeast with a tremendous appetite, leave almost no sugar behind.'],
        boil: ['施蒂利亚哥尔丁、东肯特哥尔丁、萨兹等欧洲酒花，20–35 IBU；现代版本也用空知王牌、尼尔森苏维这些新世界酒花。',
               'Continental and English hops such as Styrian Golding, East Kent Goldings and Saaz, 20–35 IBU; modern versions also use New World hops such as Sorachi Ace and Nelson Sauvin.'],
        ferment: ['赛松酵母喜欢热：约 20°C 开始，任它升到 30°C 以上，产生胡椒般的酚和果香。它能吃掉一般啤酒酵母剩下的糖，发酵度常在 90% 以上。',
                  'Saison yeast likes it hot: started around 20 °C and allowed to rise past 30 °C, for peppery phenols and fruit. It eats sugars most beer yeasts leave, often past 90% attenuation.'],
        cond: ['瓶中再发酵，气泡多。有的酒厂加入混合菌种或酒香酵母，带一丝酸和农舍味。',
               'Refermented in the bottle to a high carbonation; some brewers add mixed cultures or Brettanomyces for a tart, funky edge.']
      }
    },
    {
      id: 'dubbel', r: 'be', f: 'ale', bjcp: '26B',
      n: ['比利时双料', 'Belgian Dubbel'], local: 'Dubbel',
      p: ['韦斯特马勒修道院', 'Westmalle Abbey'], y: ['1920 年代', '1920s'],
      og: [1.062, 1.075], fg: [1.008, 1.018], abv: [6, 7.6], ibu: [15, 25], srm: [10, 17],
      glass: 'chalice', temp: [10, 13], hops: ['styrian', 'hallertau'],
      ex: ['Westmalle Dubbel', 'Chimay Rouge', 'Rochefort 6'],
      sum: ['特拉普派修道院的深色啤酒，现代的样子可以追溯到韦斯特马勒修道院一战后重建时酿的“双料棕啤”。红褐色，有葡萄干、李子和焦糖的味道，酒体却不厚重。',
            'The dark beer of the Trappist abbeys; its modern form goes back to the double brown Westmalle brewed when it rebuilt after the First World War. Red-brown, with raisin, plum and caramel, yet not heavy.'],
      steps: {
        malt: ['皮尔森麦芽加少量慕尼黑和特种麦芽。复杂的风味很大一部分来自深色的比利时糖浆（candi syrup）。',
               'Pilsner malt with a little Munich and specialty malt. Much of the complexity comes from dark Belgian candi syrup.'],
        mash: ['浸出或分段糖化，温度偏低；糖浆完全可发酵，酒体因此不厚重。',
               'An infusion or step mash on the cool side; the fully fermentable syrup keeps the body light.'],
        boil: ['深色糖浆在煮沸时加入，焦糖化的糖带来葡萄干和无花果味。酒花只为平衡，15–25 IBU。',
               'The dark syrup goes into the boil, its caramelised sugars bringing raisin and fig. Hops only for balance, 15–25 IBU.'],
        ferment: ['修道院酵母约 18°C 开始，任它升到 24–26°C，产生香蕉和李子般的酯、丁香和胡椒般的酚。',
                  'Abbey yeast started at about 18 °C and left to climb to 24–26 °C, for esters of banana and plum and phenols of clove and pepper.'],
        cond: ['加糖和新鲜酵母装瓶，在温暖的酒窖里瓶中再发酵两三周。',
               'Bottled with sugar and fresh yeast and refermented in a warm cellar for two or three weeks.']
      }
    },
    {
      id: 'tripel', r: 'be', f: 'ale', bjcp: '26C',
      n: ['比利时三料', 'Belgian Tripel'], local: 'Tripel',
      p: ['韦斯特马勒修道院', 'Westmalle Abbey'], y: ['1934 年', '1934'],
      og: [1.075, 1.085], fg: [1.008, 1.014], abv: [7.5, 9.5], ibu: [20, 40], srm: [4.5, 7],
      glass: 'chalice', temp: [8, 11], hops: ['saaz', 'styrian', 'hallertau'],
      ex: ['Westmalle Tripel', 'St. Bernardus Tripel', 'La Trappe Tripel'],
      sum: ['1934 年韦斯特马勒修道院推出的金色烈性艾尔。8–9% 的酒精藏在干爽的口感里，有香料、香蕉和梨子的香气，细腻的酒花苦，气泡丰富。',
            'A strong golden ale launched by Westmalle in 1934. Eight or nine per cent alcohol hides in a dry palate, with spice, banana and pear, a fine hop bitterness and plenty of bubbles.'],
      steps: {
        malt: ['只用皮尔森麦芽，再加最多 20% 的白糖。糖会全部发酵掉，所以这么烈的酒依然轻盈干爽。',
               'Pilsner malt alone, plus up to 20% white sugar. Sugar ferments out completely, so a strong beer stays light and dry.'],
        mash: ['低温分段糖化，追求最高的发酵度，水要偏软。',
               'A cool step mash for the highest attenuation, in fairly soft water.'],
        boil: ['萨兹、施蒂利亚哥尔丁或德国酒花，20–40 IBU。',
               'Saaz, Styrian Golding or German hops, 20–40 IBU.'],
        ferment: ['修道院酵母低温投放，再让温度升到 25°C 左右，发酵度可达 85–90%。',
                  'Abbey yeast pitched cool, then allowed to rise to about 25 °C; attenuation reaches 85–90%.'],
        cond: ['瓶中再发酵，气泡多，用圣杯或郁金香杯喝。',
               'Refermented in the bottle to a high carbonation, and served in a chalice or a tulip.']
      }
    },
    {
      id: 'lambic', r: 'be', f: 'wild', bjcp: '23D-23E',
      n: ['兰比克与贵兹', 'Lambic & Gueuze'], local: 'Lambiek, Geuze',
      p: ['布鲁塞尔 · 帕约滕兰', 'Brussels and the Pajottenland'], y: ['几百年的农家传统', 'centuries old'],
      og: [1.040, 1.054], fg: [1.000, 1.010], abv: [5, 8], ibu: [0, 10], srm: [3, 6], haze: 0.1,
      glass: 'tumbler', temp: [8, 12], hops: ['hallertau', 'saaz'],
      ex: ['Cantillon Classic Gueuze', '3 Fonteinen Oude Geuze', 'Oude Geuze Boon'],
      sum: ['布鲁塞尔西南森讷河谷的自然发酵啤酒：不加酵母，让夜里的空气把野生酵母和细菌带进麦汁，在老橡木桶里慢慢发酵一到三年。把一年、两年、三年的兰比克调在一起，在瓶中再发酵，就是贵兹：干、酸、复杂，有“布鲁塞尔香槟”之称。',
            'The spontaneously fermented beer of the Senne valley south-west of Brussels: no yeast is pitched; the night air brings wild yeasts and bacteria into the wort, which then ferments slowly for one to three years in old oak casks. Blend one-, two- and three-year-old lambic and let it referment in the bottle and you have gueuze: dry, sour and complex, the Champagne of Brussels.'],
      steps: {
        malt: ['约 60–70% 皮尔森麦芽和 30–40% 未发芽小麦。',
               'About 60–70% pilsner malt and 30–40% unmalted wheat.'],
        mash: ['“浑浊糖化”（turbid mash）：一次次抽出浑浊的醪液加热再倒回，故意留下大量没转化的淀粉和糊精，给之后几年里慢慢工作的野生微生物当口粮。',
               'A turbid mash: cloudy mash liquid is drawn off, heated and returned again and again, deliberately leaving plenty of unconverted starch and dextrin to feed the wild microbes that will work for years.'],
        boil: ['煮沸三四个小时，用陈放了三年以上的酒花：香气和苦味早已散去，只留下抑制杂菌的作用。',
               'A boil of three or four hours, with hops aged three years or more: their aroma and bitterness are gone, but they still keep unwanted bacteria in check.'],
        ferment: ['热麦汁打进屋顶下又宽又浅的冷却槽（koelschip），打开百叶窗晾一夜，一边冷却一边接住空气里的微生物，所以只在约 10 月到次年 4 月的冷天酿造。先是肠杆菌，再是酿酒酵母，之后几个月到几年里片球菌、乳酸菌和酒香酵母依次登场。',
                  'The hot wort is run into a wide, shallow coolship under the roof and left overnight with the louvres open, cooling as it takes in microbes from the air, so brewing happens only in the cold months, roughly October to April. Enteric bacteria come first, then Saccharomyces, then over months and years Pediococcus, lactic bacteria and Brettanomyces.'],
        cond: ['在橡木桶里陈一到三年。调配师把不同年份的兰比克兑在一起装瓶，瓶中再发酵，贵兹能放二十年以上。把酸樱桃泡进兰比克，就是樱桃兰比克（kriek）。',
               'Aged one to three years in oak. The blender mixes lambics of different ages and bottles them to referment, and gueuze keeps for twenty years and more. Steep sour cherries in lambic and you have kriek.']
      }
    },
    {
      id: 'flanders-red', r: 'be', f: 'wild', bjcp: '23B',
      n: ['法兰德斯红', 'Flanders Red Ale'], local: 'Vlaams rood bier',
      p: ['西法兰德斯 · 鲁瑟拉勒', 'Roeselare, West Flanders'], y: ['1821 年', '1821'],
      og: [1.048, 1.057], fg: [1.002, 1.012], abv: [4.6, 6.5], ibu: [10, 25], srm: [10, 17],
      glass: 'tulip', temp: [10, 13], hops: ['hallertau', 'styrian'],
      ex: ['Rodenbach Grand Cru', 'Duchesse de Bourgogne', 'Cuvée des Jacobins'],
      sum: ['西法兰德斯的红色酸啤，以 1821 年创立的罗登巴赫为代表，有“比利时的勃艮第”之称：酸樱桃、李子、黑醋栗，一点红酒醋和橡木，连单宁感都像红酒。由年轻的酒和在大橡木桶里陈了两年的老酒调配而成。',
            'The red sour ale of West Flanders, typified by Rodenbach, founded in 1821, and called the Burgundy of Belgium: sour cherry, plum and blackcurrant, a touch of red-wine vinegar and oak, even a wine-like tannin. Young beer is blended with beer aged two years in great oak vats.'],
      steps: {
        malt: ['维也纳或慕尼黑麦芽、几种焦香麦芽，常加玉米。',
               'Vienna or Munich malt, several caramel malts and often maize.'],
        mash: ['浸出或分段糖化。',
               'An infusion or step mash.'],
        boil: ['低 α 酸的欧洲酒花，苦度只有 10–25 IBU，因为苦和酸会打架。',
               'Low-alpha continental hops to only 10–25 IBU, because bitterness clashes with sourness.'],
        ferment: ['先用普通酵母做主发酵，再转进巨大的橡木桶（foeder），桶里住着的酵母、乳酸菌、酒香酵母和醋酸菌慢慢接手。',
                  'A main fermentation with ordinary yeast, then into great oak vats, foeders, whose resident yeasts, lactic bacteria, Brettanomyces and acetic bacteria take over slowly.'],
        cond: ['在橡木桶里陈 18 个月到两年以上。罗登巴赫的酒窖里有近三百个橡木大桶，有的能装几万升。它的 Grand Cru 是三分之二老酒加三分之一新酒。',
               'Aged 18 months to two years and more in oak. Rodenbach’s cellars hold nearly three hundred foeders, some of tens of thousands of litres. Its Grand Cru is two-thirds old beer to one-third young.']
      }
    },
    {
      id: 'american-lager', r: 'us', f: 'lager', bjcp: '1B',
      n: ['美式拉格', 'American Lager'], local: 'American lager',
      p: ['美国', 'United States'], y: ['1933 年禁酒令后', 'after Prohibition'],
      og: [1.040, 1.050], fg: [1.004, 1.010], abv: [4.2, 5.3], ibu: [8, 18], srm: [2, 3.5],
      glass: 'pint', temp: [2, 4], hops: ['magnum'],
      ex: ['Budweiser', 'Miller High Life', 'Pabst Blue Ribbon'],
      sum: ['禁酒令（1920–1933）之后，美国幸存下来的大酒厂把德国移民带来的拉格做得越来越淡、越来越干，加进大米或玉米，冰镇着喝最解渴。全世界的大众拉格都走这条路，包括同样用大米酿的青岛和雪花。',
            'After Prohibition (1920–33) the surviving American breweries made the lager German immigrants had brought ever lighter and drier, with rice or corn in the grist, to be drunk ice-cold. The world’s mass-market lagers follow it, China’s Tsingtao and Snow, also brewed with rice, among them.'],
      steps: {
        malt: ['两棱或六棱大麦麦芽，配最多 40% 的大米或玉米。六棱大麦的酶多，连辅料里的淀粉也能一起转化。',
               'Two- or six-row barley malt with up to 40% rice or corn. Six-row barley is rich in enzymes, enough to convert the adjuncts’ starch as well.'],
        mash: ['大米、玉米要先在谷物锅里单独煮成糊，让淀粉糊化，再并入麦芽醪。长时间低温糖化，让糖尽量都可发酵，所以酒体很轻。',
               'The rice or corn is first cooked on its own in a cereal cooker to gelatinise the starch, then added to the malt mash. A long, low saccharification rest makes the sugars as fermentable as possible: a very light body.'],
        boil: ['酒花很少，8–18 IBU，常用马格努姆这类高 α 酸酒花或酒花浸膏。',
               'Very few hops, 8–18 IBU, often a high-alpha hop such as Magnum, or hop extract.'],
        ferment: ['拉格酵母约 10–13°C。大厂常做“高浓酿造”：先酿出更浓的酒，再兑水稀释到目标酒精度。',
                  'Lager yeast at about 10–13 °C. Big breweries often brew at high gravity and dilute with water to strength afterwards.'],
        cond: ['贮藏、过滤，充入较多二氧化碳。百威在贮酒罐里铺上山毛榉木片，给酵母更多附着的表面，这就是它标签上的 beechwood aged。2–4°C 冰着喝。',
               'Lagered, filtered and well carbonated. Budweiser lays beechwood strips in its lagering tanks to give the yeast more surface to work on: the “beechwood aged” of its label. Serve at 2–4 °C.']
      }
    },
    {
      id: 'cal-common', r: 'us', f: 'lager', bjcp: '19B',
      n: ['加州蒸汽啤酒', 'California Common'], local: 'Steam beer',
      p: ['旧金山', 'San Francisco'], y: ['淘金热时期', 'the Gold Rush'],
      og: [1.048, 1.054], fg: [1.011, 1.014], abv: [4.5, 5.5], ibu: [30, 45], srm: [9, 14],
      glass: 'pint', temp: [8, 10], hops: ['northern-brewer'],
      ex: ['Anchor Steam Beer'],
      sum: ['淘金热时期的旧金山没有冰，酿酒师只好让拉格酵母在常温下发酵，把麦汁摊在又宽又浅的敞口槽里，借海湾的凉风散热。名字可能来自开桶时嘶嘶冒出的“蒸汽”。铁锚酒厂在 1970 年代让它复活并注册了 Steam Beer 商标，别家只能叫它“加州普通啤酒”（California common）。',
            'Gold Rush San Francisco had no ice, so brewers fermented lager yeast warm, in wide, shallow open vats that shed heat into the cool bay air. The name may come from the hiss of “steam” when a cask was tapped. Anchor Brewing revived it in the 1970s and trademarked Steam Beer, so everyone else calls it California common.'],
      steps: {
        malt: ['淡色麦芽加少量焦香麦芽，琥珀色。',
               'Pale malt with a little crystal: amber.'],
        mash: ['单次浸出糖化。',
               'A single infusion mash.'],
        boil: ['北酿（Northern Brewer）是它的标志，带木头和薄荷般的香气，苦度 30–45 IBU，相当紧实。',
               'Northern Brewer is the signature, woody and minty, to a firm 30–45 IBU.'],
        ferment: ['拉格酵母在 13–16°C 发酵，比一般拉格暖得多：有一点果香，但仍比艾尔干净。',
                  'Lager yeast at 13–16 °C, far warmer than a normal lager: a touch of fruit, but cleaner than an ale.'],
        cond: ['短暂冷藏，再加入正在发酵的新鲜麦汁（kräusening）让它在桶里或瓶里产生活泼的气泡。',
               'A short cold conditioning, then krausened, with fresh fermenting wort added, for a lively carbonation in cask or bottle.']
      }
    },
    {
      id: 'apa', r: 'us', f: 'ale', bjcp: '18B',
      n: ['美式淡色艾尔', 'American Pale Ale'], local: 'APA',
      p: ['加州奇科', 'Chico, California'], y: ['1980 年', '1980'],
      og: [1.045, 1.060], fg: [1.010, 1.015], abv: [4.5, 6.2], ibu: [30, 50], srm: [5, 10],
      glass: 'pint', temp: [6, 9], hops: ['cascade', 'centennial', 'amarillo', 'citra'],
      ex: ['Sierra Nevada Pale Ale', 'Deschutes Mirror Pond', 'Half Acre Daisy Cutter'],
      sum: ['美国精酿运动的起点之一：1980 年内华达山脉酒厂用美国本土的卡斯卡特酒花改造英式淡色艾尔，酿出一杯葡萄柚和松针香扑鼻的啤酒。在 IPA 一统天下之前，它是美国最出名的精酿风格。',
            'One of the starting points of American craft beer: in 1980 Sierra Nevada took English pale ale and hopped it with home-grown Cascade, for a beer that smells of grapefruit and pine. Before IPA took over, it was America’s best-known craft style.'],
      steps: {
        malt: ['美国两棱淡色麦芽，少量焦香麦芽。',
               'American two-row pale malt with a little crystal.'],
        mash: ['单次浸出，约 65–67°C。',
               'A single infusion at about 65–67 °C.'],
        boil: ['美国酒花在煮沸末段和回旋沉淀（whirlpool）时大量加入，30–50 IBU，常常还要干投。',
               'American hops in quantity late in the boil and in the whirlpool, to 30–50 IBU, and often dry-hopped as well.'],
        ferment: ['干净的美式艾尔酵母（如 Chico 菌株）18–20°C，几乎没有酯香，让酒花说话。',
                  'Clean American ale yeast such as the Chico strain at 18–20 °C: so few esters that the hops do the talking.'],
        cond: ['熟成一两周。内华达山脉的瓶装版至今仍在瓶中再发酵。新鲜最好。',
               'A week or two of conditioning; Sierra Nevada still referments its bottles. Best fresh.']
      }
    },
    {
      id: 'american-ipa', r: 'us', f: 'ale', bjcp: '21A',
      n: ['美式 IPA', 'American IPA'], local: 'West Coast IPA',
      p: ['美国西海岸', 'the US West Coast'], y: ['1975 年', '1975'],
      og: [1.056, 1.070], fg: [1.008, 1.014], abv: [5.5, 7.5], ibu: [40, 70], srm: [6, 14],
      glass: 'pint', temp: [7, 10], hops: ['simcoe', 'centennial', 'columbus', 'chinook', 'amarillo', 'citra', 'cascade'],
      ex: ['Bell’s Two Hearted Ale', 'Russian River Blind Pig IPA', 'Firestone Walker Union Jack'],
      sum: ['1975 年铁锚酒厂用整朵卡斯卡特酒花酿的 Liberty Ale，被看作第一款现代美式 IPA。西海岸的版本清澈、干爽、苦得直接，带松脂、柑橘和热带水果的香气。更烈更苦的是双倍 IPA。',
            'Anchor’s Liberty Ale of 1975, hopped with whole Cascade, is taken as the first modern American IPA. The West Coast take is clear, dry and frankly bitter, with resin, citrus and tropical fruit. Stronger and more bitter still is the double IPA.'],
      steps: {
        malt: ['美国两棱淡色麦芽，焦香麦芽很少甚至不用，有时加糖让收口更干。',
               'American two-row pale malt with little or no crystal, and sometimes sugar for a drier finish.'],
        mash: ['偏低的糖化温度（约 64–65°C）提高发酵度。水里加石膏，硫酸根让苦味更脆。',
               'A lowish mash, about 64–65 °C, for high attenuation, and gypsum in the water, since sulfate sharpens the bitterness.'],
        boil: ['先用高 α 酸酒花打苦，再在煮沸末段和回旋沉淀时大量加酒花，40–70 IBU。',
               'Bittered with high-alpha hops, then big additions late in the boil and in the whirlpool, to 40–70 IBU.'],
        ferment: ['干净的美式艾尔酵母。',
                  'Clean American ale yeast.'],
        cond: ['发酵结束后干投：把酒花直接泡在冷的酒里几天，只萃取挥发的香气油，几乎不增加苦味，因为 α 酸要经过煮沸才会异构化变苦。每升常用好几克。之后澄清，越新鲜越好喝。',
               'Dry-hopped after fermentation: hops steeped in the cold beer for a few days give up their volatile oils with little added bitterness, since alpha acids turn bitter only when boiled. Several grams a litre is common. Then clarified, and best drunk fresh.']
      }
    },
    {
      id: 'hazy-ipa', r: 'us', f: 'ale', bjcp: '21C',
      n: ['浑浊 IPA', 'Hazy IPA'], local: 'New England IPA',
      p: ['佛蒙特 · 新英格兰', 'Vermont, New England'], y: ['2000 年代', '2000s'],
      og: [1.060, 1.085], fg: [1.010, 1.015], abv: [6, 9], ibu: [25, 60], srm: [3, 7], haze: 0.9,
      glass: 'tulip', temp: [6, 9], hops: ['citra', 'mosaic', 'galaxy', 'nelson', 'sabro', 'simcoe'],
      ex: ['The Alchemist Heady Topper', 'Tree House Julius', 'Trillium Congress Street'],
      sum: ['新英格兰的 IPA：浑得像橙汁，苦味柔和，满是芒果、百香果和桃子的香气，口感丝滑。佛蒙特州炼金术士酒厂的 Heady Topper 被看作源头，2010 年代席卷全美。',
            'New England’s IPA: opaque as orange juice, gently bitter, full of mango, passion fruit and peach, with a silky body. The Alchemist’s Heady Topper in Vermont is taken as the source; the style swept America in the 2010s.'],
      steps: {
        malt: ['淡色麦芽加 10–30% 的燕麦片和小麦。它们的蛋白质和 β-葡聚糖撑起丝滑的口感，也和酒花多酚结合成不散的浑浊。',
               'Pale malt with 10–30% flaked oats and wheat, whose proteins and beta-glucans give the silky body and bind with hop polyphenols into a lasting haze.'],
        mash: ['水里的氯离子多于硫酸根，口感更圆润、不那么苦脆，正好和西海岸 IPA 相反。',
               'Water with more chloride than sulfate, for a rounder, softer palate: the opposite of a West Coast IPA.'],
        boil: ['煮沸时几乎不加酒花，大部分留到 80°C 以下的回旋沉淀：香气多，苦味少，25–60 IBU。',
               'Few hops in the boil; most go into a whirlpool below about 80 °C, for aroma without much bitterness, 25–60 IBU.'],
        ferment: ['用产酯的英式酵母（如 London Ale III）。发酵最旺盛时就开始干投，酵母会把酒花里的香叶醇等化合物转化成香茅醇这类更多的果香，称为“生物转化”。',
                  'An estery English strain such as London Ale III. Dry hops go in during active fermentation, when the yeast turns hop compounds such as geraniol into citronellol and other fruit, a process called biotransformation.'],
        cond: ['发酵后再大量干投，加起来每升 10–20 克。不过滤，很怕氧化：要冷藏，几周内喝完，香气才不会变暗。',
                'Another heavy dry hop after fermentation, 10–20 g a litre in all. Unfiltered and easily oxidised: keep it cold and drink it within weeks, before the aroma dulls.']
      }
    },
    {
      id: 'nz-pils', r: 'us', f: 'lager', bjcp: 'X5',
      n: ['新西兰皮尔森', 'New Zealand Pilsner'], local: 'NZ Pilsner',
      p: ['新西兰', 'New Zealand'], y: ['1990 年代中', 'mid-1990s'],
      og: [1.044, 1.056], fg: [1.009, 1.014], abv: [4.5, 5.8], ibu: [25, 45], srm: [2, 6],
      glass: 'pilsner', temp: [5, 7], hops: ['motueka', 'nelson'],
      ex: ['Emerson’s Pilsner', 'Tuatara Mot Eureka', 'Croucher New Zealand Pilsner'],
      sum: ['照德国人的方法酿的拉格，换上新西兰的酒花：青柠、百香果、白葡萄和青草的香气扑面而来。大体由 1990 年代中期但尼丁的爱默生酒厂定型，新西兰的酒花品种越多，它也越丰富。',
            'A lager brewed the German way and hopped with New Zealand varieties: lime, passion fruit, white grape and cut grass leap out of the glass. Largely defined by Emerson’s of Dunedin in the mid-1990s, it has grown with every new New Zealand hop.'],
      steps: {
        malt: ['皮尔森或淡色麦芽，有时加一点小麦麦芽。',
               'Pilsner or pale malt, sometimes with a little wheat malt.'],
        mash: ['矿物质低的软水，氯离子多于硫酸根，单次浸出或分段糖化。',
               'Soft, low-mineral water with more chloride than sulfate; an infusion or step mash.'],
        boil: ['常用太平洋翡翠（Pacific Jade）打苦，煮沸末段大量加莫图依卡、尼尔森苏维、里瓦卡，25–45 IBU。',
               'Often bittered with Pacific Jade, then generous late additions of Motueka, Nelson Sauvin or Riwaka, to 25–45 IBU.'],
        ferment: ['干净的拉格酵母，或非常中性的艾尔酵母。',
                  'Clean lager yeast, or a very neutral ale yeast.'],
        cond: ['低温贮藏，有时干投；清澈，干爽，酒花香浓。',
               'Lagered cold and sometimes dry-hopped: clear, dry and hop-scented.']
      }
    }
  ];

  /* Where a hop comes from: the hop filter's groups, in order */
  var HOP_ORIGINS = [
    { key: 'de', name: ['德国', 'Germany'] },
    { key: 'cz', name: ['捷克与斯洛文尼亚', 'Czechia & Slovenia'] },
    { key: 'uk', name: ['英国', 'England'] },
    { key: 'us', name: ['美国', 'United States'] },
    { key: 'nz', name: ['新西兰与澳大利亚', 'New Zealand & Australia'] },
    { key: 'jp', name: ['日本', 'Japan'] }
  ];

  /* o: origin, use: aroma | bitter | dual. alpha, beta: % by weight; cohum: cohumulone, % of the alpha
     acids; oil: total oil, mL per 100 g; myrcene to farnesene: % of the total oil. sub: hops that can
     stand in for it. src: where the numbers come from. */
  var HOPS = [
    {
      id: 'hallertau', o: 'de', use: 'aroma',
      n: ['哈拉道中早熟', 'Hallertauer Mittelfrüh'], local: 'Hallertauer Mittelfrüh',
      p: ['德国 · 哈拉道', 'Hallertau, Bavaria'], y: ['传统品种', 'a landrace'],
      alpha: [3, 5.5], beta: [3, 5], cohum: [18, 28], oil: [0.7, 1.3],
      myrcene: [20, 35], humulene: [45, 55], caryophyllene: [10, 15], farnesene: [0, 1],
      aroma: [['花香', '草本', '香料', '木质'], ['floral', 'herbal', 'spicy', 'woody']],
      story: ['哈拉道在慕尼黑北边，是世界上最大的连片酒花产区。中早熟是那里的老品种，贵族酒花里的头一个，香气柔和：花香、草本、淡淡的香料。它容易得黄萎病，种得越来越少，很多酒厂改用它的后代，比如哈拉道传统（Hallertauer Tradition）。',
              'The Hallertau, north of Munich, is the largest continuous hop-growing area in the world, and Mittelfrüh is its old landrace, the first of the noble hops: soft, floral, herbal and lightly spicy. Prone to verticillium wilt, it has been planted less and less, and many brewers moved to its descendants such as Hallertauer Tradition.'],
      sub: ['tettnang', 'spalt'], src: []
    },
    {
      id: 'tettnang', o: 'de', use: 'aroma',
      n: ['泰特南', 'Tettnanger'], local: 'Tettnanger',
      p: ['德国 · 博登湖畔的泰特南', 'Tettnang, by Lake Constance'], y: ['传统品种', 'a landrace'],
      alpha: [3.5, 5.5], beta: [3.5, 5.5], cohum: [22, 28], oil: [0.5, 0.9],
      myrcene: [20, 35], humulene: [22, 32], caryophyllene: [6, 11], farnesene: [16, 24],
      aroma: [['花香', '草本', '胡椒'], ['floral', 'herbal', 'peppery']],
      story: ['博登湖北岸小城泰特南的地方品种，贵族酒花之一，产量不大，名气很大。它和萨兹是近亲，花香、草本里带一点胡椒；金合欢烯多，所以比哈拉道更“花”。',
              'The landrace of Tettnang on the north shore of Lake Constance, one of the noble hops: a small crop with a big name. A close relative of Saaz, floral and herbal with a little pepper; its farnesene makes it more flowery than Hallertau.'],
      sub: ['saaz', 'spalt'], src: []
    },
    {
      id: 'spalt', o: 'de', use: 'aroma',
      n: ['斯帕尔特', 'Spalter'], local: 'Spalter',
      p: ['德国 · 弗兰肯的斯帕尔特', 'Spalt, Franconia'], y: ['传统品种', 'a landrace'],
      alpha: [3, 5.5], beta: [3, 5], cohum: [22, 29], oil: [0.5, 1.1],
      myrcene: [20, 35], humulene: [20, 30], caryophyllene: [8, 13], farnesene: [12, 18],
      aroma: [['木质', '泥土', '香料', '花香'], ['woody', 'earthy', 'spicy', 'floral']],
      story: ['纽伦堡南边小城斯帕尔特的地方品种，1538 年这里成了德国第一个有官方质量印章的酒花产地。和萨兹、泰特南同属“萨兹型”，香气温和：木质、泥土和香料。',
              'The landrace of Spalt, south of Nuremberg, which in 1538 became the first hop-growing area in Germany with an official seal of quality. A Saaz type, like Saaz and Tettnanger: mild, woody, earthy and spicy.'],
      sub: ['saaz', 'tettnang'], src: []
    },
    {
      id: 'magnum', o: 'de', use: 'bitter',
      n: ['马格努姆', 'Hallertauer Magnum'], local: 'Hallertauer Magnum',
      p: ['德国 · 哈拉道', 'Hallertau, Germany'], y: ['1993 年', '1993'],
      by: ['许尔酒花研究所', 'the Hüll Hop Research Center'], parent: ['Galena × 德国雄株', 'Galena × a German male'],
      alpha: [11, 16], beta: [5, 7], cohum: [21, 29], oil: [1.6, 2.6],
      myrcene: [30, 45], humulene: [30, 45], caryophyllene: [8, 13], farnesene: [0, 1],
      aroma: [['干净', '淡淡的香料', '柑橘'], ['clean', 'light spice', 'citrus']],
      story: ['许尔酒花研究所育成、1993 年推出的高 α 酸品种。苦味干净，几乎不带香气，是全世界最常用的打苦酒花之一：很多啤酒在煮沸一开始加一点马格努姆打底，再用香型酒花收尾。',
              'Bred at the Hüll hop research centre and released in 1993, a high-alpha hop with a clean bitterness and little aroma, and one of the most used bittering hops in the world: many beers start the boil with a little Magnum and finish with aroma hops.'],
      sub: ['columbus', 'northern-brewer'], src: []
    },
    {
      id: 'saaz', o: 'cz', use: 'aroma',
      n: ['萨兹', 'Saaz'], local: 'Žatecký poloraný červeňák',
      p: ['捷克 · 扎泰茨', 'Žatec, Bohemia'], y: ['传统品种', 'a landrace'],
      alpha: [2.5, 4.5], beta: [4, 6], cohum: [23, 28], oil: [0.4, 0.8],
      myrcene: [25, 40], humulene: [15, 25], caryophyllene: [6, 9], farnesene: [11, 20],
      aroma: [['草本', '泥土', '香料', '柠檬'], ['herbal', 'earthy', 'spicy', 'lemon']],
      story: ['波希米亚扎泰茨（德语叫萨兹）一带的地方品种，在那里种了几百年，四大“贵族酒花”之一。α 酸很低，β 酸往往比 α 酸还高，香气细腻：草本、泥土、香料，带一点柠檬。捷克皮尔森离不开它，比利时的酿酒师也爱用。',
              'A landrace of the country around Žatec (Saaz in German) in Bohemia, grown there for centuries, and one of the four “noble” hops. Very low in alpha acid, often with more beta acid than alpha, and delicate: herbal, earthy and spicy with a little lemon. Czech pilsner can’t do without it, and Belgian brewers love it too.'],
      sub: ['tettnang', 'spalt'], src: []
    },
    {
      id: 'styrian', o: 'cz', use: 'aroma',
      n: ['施蒂利亚哥尔丁', 'Styrian Golding'], local: 'Savinjski golding',
      p: ['斯洛文尼亚 · 萨维尼亚河谷', 'the Savinja valley, Slovenia'], y: null,
      parent: ['法格尔的克隆', 'a clone of Fuggle'],
      alpha: [2.5, 6], beta: [2, 3.5], cohum: [25, 30], oil: [0.5, 1],
      myrcene: [27, 33], humulene: [34, 38], caryophyllene: [9, 11], farnesene: [2, 5],
      aroma: [['泥土', '白胡椒', '柠檬', '花香'], ['earthy', 'white pepper', 'lemon', 'floral']],
      story: ['名字叫“哥尔丁”，其实是法格尔：斯洛文尼亚人当年以为从英国引进的是哥尔丁，后来的基因检测证明它就是法格尔。在萨维尼亚河谷的土地上，它长出了更细腻的香气：泥土、白胡椒、一点柠檬和花香。比利时的酿酒师特别喜欢它。',
              'A Golding in name only: the Slovenian growers who brought it from England took it for Goldings, and genetic tests have since shown it is Fuggle. In the soil of the Savinja valley it grew a finer aroma, earthy, with white pepper and a little lemon and flowers, and Belgian brewers took to it.'],
      sub: ['fuggle', 'ekg'], src: []
    },
    {
      id: 'ekg', o: 'uk', use: 'aroma',
      n: ['东肯特哥尔丁', 'East Kent Goldings'], local: 'East Kent Goldings',
      p: ['英格兰 · 肯特郡东部', 'East Kent, England'], y: ['18 世纪末', 'late 1700s'],
      by: ['肯特郡的哥尔丁先生', 'a Mr Golding of Kent'],
      alpha: [4, 6.5], beta: [1.9, 3.5], cohum: [20, 30], oil: [0.4, 1],
      myrcene: [20, 26], humulene: [38, 44], caryophyllene: [12, 16], farnesene: [0, 1],
      aroma: [['蜂蜜', '泥土', '薰衣草', '香料'], ['honey', 'earthy', 'lavender', 'spicy']],
      story: ['18 世纪末肯特郡一位哥尔丁先生选出的品种。只有种在东肯特的才能叫 East Kent Goldings，这是受保护的原产地名称。蜂蜜、泥土、薰衣草和一点橘子酱般的甜香，是英国苦啤和 IPA 的经典味道。',
              'Selected by a Mr Golding in Kent in the late 1700s. Only Goldings grown in East Kent may be sold as East Kent Goldings, a protected designation of origin. Honey, earth, lavender and a marmalade sweetness: the classic aroma of English bitter and IPA.'],
      sub: ['fuggle', 'styrian'], src: []
    },
    {
      id: 'fuggle', o: 'uk', use: 'aroma',
      n: ['法格尔', 'Fuggle'], local: 'Fuggle',
      p: ['英格兰 · 肯特', 'Kent, England'], y: ['1875 年', '1875'],
      by: ['理查德·法格尔推出', 'introduced by Richard Fuggle'], parent: ['花园里自己长出来的实生苗', 'a chance seedling in a garden'],
      alpha: [3, 6], beta: [1.5, 3], cohum: [23, 33], oil: [0.7, 1.4],
      myrcene: [24, 28], humulene: [33, 38], caryophyllene: [9, 13], farnesene: [4, 6],
      aroma: [['泥土', '木质', '薄荷', '青草'], ['earthy', 'woody', 'minty', 'grassy']],
      story: ['1861 年在肯特郡一户人家的花园里自己长出来的实生苗，1875 年由理查德·法格尔推广，一度占英国酒花种植面积的七成以上。泥土、木质、薄荷和青草的味道，是英式波特和苦啤的底色。美国的威拉米特是它的后代，斯洛文尼亚的“施蒂利亚哥尔丁”就是它本身。',
              'A chance seedling that came up in a garden in Kent in 1861 and was introduced by Richard Fuggle in 1875, it once made up more than 70% of English hop acreage. Earthy, woody, minty and grassy, it is the backbone of English porter and bitter. America’s Willamette is its offspring; Slovenia’s “Styrian Golding” is Fuggle itself.'],
      sub: ['styrian', 'ekg'], src: []
    },
    {
      id: 'northern-brewer', o: 'uk', use: 'dual',
      n: ['北酿', 'Northern Brewer'], local: 'Northern Brewer',
      p: ['英格兰育成，如今主要种在德国', 'bred in England, now grown mostly in Germany'], y: ['1934 年育成', 'bred in 1934'],
      by: ['英国怀伊学院', 'Wye College, England'], parent: ['坎特伯雷哥尔丁 × 带北美野生血统的雄株', 'Canterbury Golding × a male with wild North American blood'],
      alpha: [6, 10], beta: [3, 5], cohum: [20, 30], oil: [1, 1.6],
      myrcene: [25, 45], humulene: [25, 35], caryophyllene: [12, 15], farnesene: [0, 1],
      aroma: [['木质', '薄荷', '松针', '泥土'], ['woody', 'minty', 'piney', 'earthy']],
      story: ['1934 年英国怀伊学院育成，如今主要种在德国的哈拉道。木质、薄荷和松针般的香气，苦味有力。加州蒸汽啤酒用的就是它，德国的珍珠（Perle）是它的后代。',
              'Bred at Wye College in England in 1934 and now grown mostly in Germany’s Hallertau. Woody, minty and piney, with a firm bitterness; it is the hop of California common, and Germany’s Perle is its offspring.'],
      sub: ['chinook', 'magnum'], src: []
    },
    {
      id: 'cascade', o: 'us', use: 'aroma',
      n: ['卡斯卡特', 'Cascade'], local: 'Cascade',
      p: ['美国 · 俄勒冈', 'Oregon, USA'], y: ['1972 年', '1972'],
      by: ['美国农业部与俄勒冈州立大学', 'the USDA and Oregon State University'], parent: ['法格尔 × 俄国的 Serebrianka', 'Fuggle × Serebrianka, a Russian hop'],
      alpha: [4.5, 8.9], beta: [3.6, 7.5], cohum: [33, 40], oil: [0.8, 2.5],
      myrcene: [45, 60], humulene: [8, 16], caryophyllene: [3, 6], farnesene: [4, 8],
      aroma: [['葡萄柚', '花香', '柑橘', '松针'], ['grapefruit', 'floral', 'citrus', 'pine']],
      story: ['美国农业部和俄勒冈州立大学育成，1972 年推出，第一个大获成功的美国香型酒花。葡萄柚和花香：1975 年铁锚酒厂的 Liberty Ale 和 1980 年的内华达山脉淡色艾尔都靠它，开启了美国精酿的“柑橘时代”。',
              'Bred by the USDA and Oregon State University and released in 1972, the first American aroma hop to take off. Grapefruit and flowers: it made Anchor’s Liberty Ale of 1975 and Sierra Nevada Pale Ale of 1980, and opened American craft beer’s citrus age.'],
      sub: ['centennial', 'amarillo'], src: []
    },
    {
      id: 'centennial', o: 'us', use: 'dual',
      n: ['百年', 'Centennial'], local: 'Centennial',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['1990 年', '1990'],
      by: ['华盛顿州立大学与美国农业部', 'Washington State University and the USDA'],
      alpha: [9.5, 11.5], beta: [3.5, 4.5], cohum: [28, 30], oil: [1.5, 2.5],
      myrcene: [45, 55], humulene: [10, 18], caryophyllene: [5, 8], farnesene: [0, 1],
      aroma: [['柠檬', '柑橘', '花香', '松针'], ['lemon', 'citrus', 'floral', 'pine']],
      story: ['1974 年育成、1990 年推出，因为香气浓郁被叫作“超级卡斯卡特”：柠檬、柑橘和花香，α 酸约 10%，打苦增香两用。贝尔酒厂的 Two Hearted 只用它一种酒花。',
              'Bred in 1974 and released in 1990, and nicknamed “super Cascade” for its intensity: lemon, citrus and flowers at about 10% alpha, for bitterness and aroma alike. Bell’s Two Hearted Ale uses nothing else.'],
      sub: ['cascade', 'columbus'], src: []
    },
    {
      id: 'chinook', o: 'us', use: 'dual',
      n: ['奇努克', 'Chinook'], local: 'Chinook',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['1985 年', '1985'],
      by: ['美国农业部', 'the USDA'], parent: ['Petham Golding × 美国农业部的雄株', 'Petham Golding × a USDA male'],
      alpha: [12, 14], beta: [3, 4], cohum: [29, 35], oil: [1.5, 2.7],
      myrcene: [35, 40], humulene: [18, 25], caryophyllene: [9, 11], farnesene: [0, 1],
      aroma: [['松脂', '葡萄柚', '香料', '烟熏'], ['pine resin', 'grapefruit', 'spicy', 'smoky']],
      story: ['1985 年美国农业部推出的高 α 酸品种，本来是为了打苦，香气却很有个性：松脂、葡萄柚、香料和一点烟熏。西海岸 IPA 里的松树味，很多来自它。',
              'A high-alpha hop released by the USDA in 1985, bred for bittering but with a personality of its own: pine resin, grapefruit, spice and a little smoke. Much of the pine in West Coast IPA is Chinook.'],
      sub: ['columbus', 'simcoe'], src: []
    },
    {
      id: 'columbus', o: 'us', use: 'bitter',
      n: ['哥伦布', 'Columbus'], local: 'CTZ: Columbus, Tomahawk, Zeus',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['1990 年代', '1990s'],
      alpha: [14, 18], beta: [4.5, 6], cohum: [28, 35], oil: [2.5, 3.5],
      myrcene: [25, 55], humulene: [9, 25], caryophyllene: [6, 12], farnesene: [0, 1],
      aroma: [['大麻般的 dank', '黑胡椒', '甘草', '柑橘'], ['dank', 'black pepper', 'liquorice', 'citrus']],
      story: ['哥伦布、战斧和宙斯三个名字，说的是同一个品种，或者几乎相同，合称 CTZ，这是当年两家公司争夺品种权留下的。α 酸高达 14–18%，是美式 IPA 打苦的主力，香气很冲：大麻般的“dank”、黑胡椒和甘草。',
              'Columbus, Tomahawk and Zeus are one hop, or near enough, together CTZ, the legacy of a dispute between two companies over the variety. At 14–18% alpha it is the bittering workhorse of American IPA, with a pungent aroma: dank and cannabis-like, black pepper and liquorice.'],
      sub: ['chinook', 'magnum'], src: []
    },
    {
      id: 'simcoe', o: 'us', use: 'dual',
      n: ['西姆科', 'Simcoe'], local: 'Simcoe',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['2000 年', '2000'],
      by: ['Yakima Chief Ranches', 'Yakima Chief Ranches'],
      alpha: [12, 14], beta: [4, 5], cohum: [15, 20], oil: [2, 2.5],
      myrcene: [60, 65], humulene: [10, 15], caryophyllene: [5, 8], farnesene: [0, 1],
      aroma: [['百香果', '杏子', '松针', '泥土'], ['passion fruit', 'apricot', 'pine', 'earthy']],
      story: ['2000 年由 Yakima Chief Ranches 推出，α 酸 12–14%，香气复杂：百香果、杏子、松针，还有一点酿酒师委婉地叫作“猫味”（catty）的气息。Pliny the Elder 这样的西海岸双倍 IPA 让它成了经典；马赛克是它的女儿。',
              'Released by Yakima Chief Ranches in 2000, at 12–14% alpha, with a complex aroma: passion fruit, apricot and pine, and a note brewers politely call “catty”. West Coast double IPAs such as Pliny the Elder made it a classic; Mosaic is its daughter.'],
      sub: ['mosaic', 'chinook'], src: []
    },
    {
      id: 'amarillo', o: 'us', use: 'aroma',
      n: ['阿马里洛', 'Amarillo'], local: 'Amarillo',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['2000 年前后', 'about 2000'],
      by: ['维吉尔·加马什农场', 'Virgil Gamache Farms'], parent: ['在酒花田里偶然发现的一株', 'a chance find in a hop yard'],
      alpha: [7, 11], beta: [5.5, 8], cohum: [21, 24], oil: [1.5, 1.9],
      myrcene: [68, 70], humulene: [9, 11], caryophyllene: [2, 4], farnesene: [2, 4],
      aroma: [['橙子', '葡萄柚', '花香', '杏子'], ['orange', 'grapefruit', 'floral', 'apricot']],
      story: ['不是育种育出来的，而是维吉尔·加马什农场在自家酒花田里偶然发现的一株，后来以 Amarillo 的名字申请了专利。橙子、葡萄柚和花香，比卡斯卡特更甜、更像橙子。',
              'Not bred but found: a chance plant in a hop yard of Virgil Gamache Farms in Washington, later patented as Amarillo. Orange, grapefruit and flowers, sweeter and more orange than Cascade.'],
      sub: ['cascade', 'centennial'], src: []
    },
    {
      id: 'citra', o: 'us', use: 'dual',
      n: ['西楚', 'Citra'], local: 'HBC 394',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['2008 年', '2008'],
      by: ['Hop Breeding Company', 'the Hop Breeding Company'],
      alpha: [11, 15], beta: [3, 4.5], cohum: [20, 35], oil: [1.5, 3],
      myrcene: [60, 70], humulene: [7, 12], caryophyllene: [5, 8], farnesene: [0, 1],
      aroma: [['葡萄柚', '青柠', '百香果', '荔枝', '芒果'], ['grapefruit', 'lime', 'passion fruit', 'lychee', 'mango']],
      story: ['Hop Breeding Company 育成，2008 年推出，编号 HBC 394。香气浓烈：葡萄柚、青柠、百香果、荔枝和芒果。它几乎凭一己之力把美式 IPA 从松针苦带到了热带水果香，如今是美国种得最多的酒花之一。',
              'Bred by the Hop Breeding Company and released in 2008 as HBC 394. Loud: grapefruit, lime, passion fruit, lychee and mango. It all but single-handedly moved American IPA from pine to tropical fruit, and is now among the most planted hops in the United States.'],
      sub: ['galaxy', 'mosaic'], src: []
    },
    {
      id: 'mosaic', o: 'us', use: 'dual',
      n: ['马赛克', 'Mosaic'], local: 'HBC 369',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['2012 年', '2012'],
      by: ['Hop Breeding Company', 'the Hop Breeding Company'], parent: ['西姆科 × 带 Nugget 血统的雄株', 'Simcoe × a male descended from Nugget'],
      alpha: [11.5, 13.5], beta: [3.2, 3.9], cohum: [24, 26], oil: [1, 1.5],
      myrcene: [47, 53], humulene: [13, 16], caryophyllene: [5, 8], farnesene: [0, 1],
      aroma: [['蓝莓', '热带水果', '柑橘', '松针'], ['blueberry', 'tropical fruit', 'citrus', 'pine']],
      story: ['编号 HBC 369，2012 年推出，西姆科的女儿。香气像马赛克拼贴一样一层叠一层：蓝莓、热带水果、柑橘、松针和草本，名字就是这么来的。浑浊 IPA 里最常见的酒花之一。',
              'HBC 369, released in 2012, a daughter of Simcoe. Its aroma is layered like a mosaic, hence the name: blueberry, tropical fruit, citrus, pine and herbs. One of the commonest hops in hazy IPA.'],
      sub: ['citra', 'simcoe'], src: []
    },
    {
      id: 'sabro', o: 'us', use: 'aroma',
      n: ['萨布罗', 'Sabro'], local: 'HBC 438',
      p: ['美国 · 华盛顿州', 'Washington, USA'], y: ['2018 年', '2018'],
      by: ['Hop Breeding Company', 'the Hop Breeding Company'], parent: ['新墨西哥野生酒花 × 雄株', 'a wild New Mexico hop × a male'],
      alpha: [12, 16], beta: [4, 7], cohum: [20, 24], oil: [2.5, 3.5],
      myrcene: [40, 50], humulene: [20, 25], caryophyllene: [7, 9], farnesene: [0, 1],
      aroma: [['椰子', '橘子', '奶油', '雪松', '薄荷'], ['coconut', 'tangerine', 'cream', 'cedar', 'mint']],
      story: ['编号 HBC 438，2018 年推出，亲本之一是新墨西哥州山里的野生酒花（Humulus lupulus var. neomexicanus）。香气独一份：椰子、橘子、奶油和热带水果，还有一丝薄荷和雪松。',
              'HBC 438, released in 2018, with a wild hop from the mountains of New Mexico, Humulus lupulus var. neomexicanus, among its parents. Like nothing else: coconut, tangerine, cream and tropical fruit, with a breath of mint and cedar.'],
      sub: [], src: []
    },
    {
      id: 'nelson', o: 'nz', use: 'dual',
      n: ['尼尔森苏维', 'Nelson Sauvin'], local: 'Nelson Sauvin',
      p: ['新西兰 · 尼尔森', 'Nelson, New Zealand'], y: ['2000 年', '2000'],
      by: ['新西兰园艺研究所', 'HortResearch, New Zealand'], parent: ['Smoothcone × 新西兰雄株', 'Smoothcone × a New Zealand male'],
      alpha: [12, 13], beta: [6, 8], cohum: [22, 26], oil: [1, 1.2],
      myrcene: [20, 25], humulene: [35, 40], caryophyllene: [10, 12], farnesene: [0, 1],
      aroma: [['白葡萄', '醋栗', '百香果', '青草'], ['white grape', 'gooseberry', 'passion fruit', 'cut grass']],
      story: ['2000 年由新西兰园艺研究所推出，名字取自产地尼尔森和长相思葡萄（Sauvignon Blanc），因为它真的闻起来像新西兰的长相思：白葡萄、醋栗、百香果和一点青草。喝惯白葡萄酒的人很容易爱上它。',
              'Released by New Zealand’s HortResearch in 2000 and named for the Nelson region and for Sauvignon blanc, because it really does smell like a New Zealand sauvignon: white grape, gooseberry, passion fruit and cut grass. White-wine drinkers fall for it easily.'],
      sub: [], src: []
    },
    {
      id: 'motueka', o: 'nz', use: 'dual',
      n: ['莫图依卡', 'Motueka'], local: 'Motueka',
      p: ['新西兰 · 尼尔森地区', 'Nelson region, New Zealand'], y: ['1998 年', '1998'],
      by: ['新西兰园艺研究所', 'HortResearch, New Zealand'], parent: ['萨兹 × 新西兰品系，三分之二是萨兹', 'Saaz × New Zealand stock, two-thirds Saaz'],
      alpha: [6.5, 7.5], beta: [5, 5.5], cohum: [27, 31], oil: [0.8, 0.8],
      myrcene: [45, 50], humulene: [3, 4], caryophyllene: [1.5, 2.5], farnesene: [11, 13],
      aroma: [['青柠', '柠檬皮', '热带水果', '香草植物'], ['lime', 'lemon zest', 'tropical fruit', 'fresh herbs']],
      story: ['1998 年推出，三分之二是萨兹的血统，有人叫它“新西兰萨兹”，香气却更明亮：青柠、柠檬皮和热带水果。新西兰皮尔森和不少比利时风格的啤酒都爱用它。',
              'Released in 1998, two-thirds Saaz by parentage and sometimes called New Zealand Saaz, but brighter: lime, lemon zest and tropical fruit. A favourite for New Zealand pilsner and for Belgian-style beers.'],
      sub: ['saaz'], src: []
    },
    {
      id: 'galaxy', o: 'nz', use: 'dual',
      n: ['银河', 'Galaxy'], local: 'Galaxy',
      p: ['澳大利亚', 'Australia'], y: ['2009 年', '2009'],
      by: ['Hop Products Australia', 'Hop Products Australia'], parent: ['高 α 酸雌株 × 珍珠（Perle）雄株', 'a high-alpha female × a Perle male'],
      alpha: [13.5, 15], beta: [5.8, 6], cohum: [32, 42], oil: [2.4, 2.7],
      myrcene: [33, 69], humulene: [1, 2], caryophyllene: [7, 9], farnesene: [2, 4],
      aroma: [['百香果', '桃子', '柑橘', '菠萝'], ['passion fruit', 'peach', 'citrus', 'pineapple']],
      story: ['澳大利亚 Hop Products Australia 育成，2009 年推出，α 酸和精油都很高。百香果、桃子和柑橘，香气强得一点点就够。浑浊 IPA 和澳大利亚的淡色艾尔都离不开它。',
              'Bred by Hop Products Australia and released in 2009, high in both alpha acid and oil. Passion fruit, peach and citrus, so intense that a little goes a long way. A mainstay of hazy IPA and of Australian pale ale.'],
      sub: ['citra'], src: []
    },
    {
      id: 'sorachi', o: 'jp', use: 'dual',
      n: ['空知王牌', 'Sorachi Ace'], local: 'Sorachi Ace',
      p: ['日本 · 北海道', 'Hokkaido, Japan'], y: ['1984 年', '1984'],
      by: ['札幌啤酒', 'Sapporo Breweries'], parent: ['Brewer’s Gold × 萨兹 × 北海道品系', 'Brewer’s Gold × Saaz × a Hokkaido line'],
      alpha: [11, 16], beta: [6, 8], cohum: [23, 28], oil: [2, 3],
      myrcene: [45, 55], humulene: [20, 26], caryophyllene: [7, 11], farnesene: [2, 5],
      aroma: [['柠檬', '莳萝', '椰子', '木质'], ['lemon', 'dill', 'coconut', 'woody']],
      story: ['札幌啤酒 1978 年在北海道育成、1984 年登记，名字来自北海道的空知地区。本来为札幌自家的啤酒而育，却是在美国精酿里走红的：柠檬、莳萝、椰子和一点木香，辨识度极高。布鲁克林酒厂的 Sorachi Ace 赛松让它出了名。',
              'Bred by Sapporo in Hokkaido in 1978 and registered in 1984, named for the Sorachi district. Meant for Sapporo’s own beers, it found its following among American craft brewers instead: lemon, dill, coconut and a little wood, impossible to mistake. Brooklyn Brewery’s Sorachi Ace saison made its name.'],
      sub: [], src: []
    }
  ];

  return { REGIONS: REGIONS, FERMENTS: FERMENTS, GLASSES: GLASSES, STYLES: STYLES, HOP_ORIGINS: HOP_ORIGINS, HOPS: HOPS };
})();
if (typeof module !== 'undefined') module.exports = OGData;
