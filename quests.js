// ─────────────────────────────────────────────────────────────
// OnlyBirdNerds — Quest & Badge System  v2
// ─────────────────────────────────────────────────────────────
// Badges  = earned quests  (compute → earned: true)
// Quests  = not yet earned (shown with progress bar)
// All computation is client-side from the user's eBird CSV.
// ─────────────────────────────────────────────────────────────

var TIERS = [
  { id: 1, name: 'Fledgling', icon: '🐣', color: '#7aab88' },
  { id: 2, name: 'Watcher',   icon: '🦜', color: '#c97d22' },
  { id: 3, name: 'Birder',    icon: '🦅', color: '#4a7c59' },
  { id: 4, name: 'Expert',    icon: '🔭', color: '#d4622a' },
  { id: 5, name: 'Legend',    icon: '👑', color: '#f0b429' },
];

var CATEGORIES = [
  { id: 'lifelist',  label: 'Life List',   icon: '🐦' },
  { id: 'dedicated', label: 'Dedication',  icon: '📋' },
  { id: 'geo',       label: 'Geographic',  icon: '🗺️' },
  { id: 'temporal',  label: 'Temporal',    icon: '⏰' },
  { id: 'species',   label: 'Species',     icon: '🔬' },
  { id: 'regional',  label: 'Regional',    icon: '🌎' },
];

// ─────────────────────────────────────────────────────────────
// STAT ENGINE
// ─────────────────────────────────────────────────────────────
function computeStats(records) {
  var speciesSeen   = {};
  var checklistIds  = {};
  var yearSpecies   = {};
  var yearMonths    = {};
  var speciesByDay  = {};
  var monthsActive  = {};
  var seasonsActive = {};
  var states        = {};
  var counties      = {};
  var countries     = {};
  var preSixSubs    = {};
  var preEightSubs  = {};

  // Regional county sets  (eBird uses US-XX codes)
  var pnwCounties     = {};  // US-OR + US-WA
  var caCounties      = {};  // US-CA
  var desertCounties  = {};  // US-AZ + US-NV + US-UT + US-NM
  var txCounties      = {};  // US-TX
  var flCounties      = {};  // US-FL
  var rockiesCounties = {};  // US-CO + US-ID + US-MT + US-WY

  records.forEach(function(r) {
    speciesSeen[r.name]   = true;
    checklistIds[r.subId] = true;

    if (r.state) {
      states[r.state] = true;
      var ctry = r.state.indexOf('-') !== -1 ? r.state.split('-')[0] : r.state;
      if (ctry) countries[ctry] = true;
    }
    var countyKey = r.state + '|' + r.county;
    if (r.county && r.state) {
      counties[countyKey] = true;
      var st = r.state;
      if (st === 'US-OR' || st === 'US-WA')                                                       pnwCounties[countyKey]     = true;
      if (st === 'US-CA')                                                                           caCounties[countyKey]      = true;
      if (st === 'US-AZ' || st === 'US-NV' || st === 'US-UT' || st === 'US-NM')                   desertCounties[countyKey]  = true;
      if (st === 'US-TX')                                                                           txCounties[countyKey]      = true;
      if (st === 'US-FL')                                                                           flCounties[countyKey]      = true;
      if (st === 'US-CO' || st === 'US-ID' || st === 'US-MT' || st === 'US-WY')                   rockiesCounties[countyKey] = true;
    }

    if (r.year) {
      if (!yearSpecies[r.year]) yearSpecies[r.year] = {};
      yearSpecies[r.year][r.name] = true;
      if (!yearMonths[r.year])   yearMonths[r.year]  = {};
      if (r.month) yearMonths[r.year][r.month] = true;
    }
    if (r.date) {
      if (!speciesByDay[r.date]) speciesByDay[r.date] = {};
      speciesByDay[r.date][r.name] = true;
    }
    if (r.month) {
      monthsActive[r.month] = true;
      var mo = Number(r.month);
      seasonsActive[(mo === 12 || mo <= 2) ? 1 : mo <= 5 ? 2 : mo <= 8 ? 3 : 4] = true;
    }
    if (r.subId && r.time) {
      var mins = _parseTimeMins(r.time);
      if (mins >= 0 && mins < 360) preSixSubs[r.subId]   = true;
      if (mins >= 0 && mins < 480) preEightSubs[r.subId] = true;
    }
  });

  var bestYearCount = 0, bestYearLabel = '';
  Object.keys(yearSpecies).forEach(function(y) {
    var n = Object.keys(yearSpecies[y]).length;
    if (n > bestYearCount) { bestYearCount = n; bestYearLabel = y; }
  });

  var maxDay = 0;
  Object.values(speciesByDay).forEach(function(d) {
    var n = Object.keys(d).length; if (n > maxDay) maxDay = n;
  });

  var yearsAllMonths = Object.keys(yearMonths).filter(function(y) {
    return Object.keys(yearMonths[y]).length >= 12;
  }).length;

  return {
    _speciesSeen:       speciesSeen,
    totalSpecies:       Object.keys(speciesSeen).length,
    totalChecklists:    Object.keys(checklistIds).length,
    bestYearCount:      bestYearCount,
    bestYearLabel:      bestYearLabel,
    activeMonths:       Object.keys(monthsActive).length,
    seasonsWithBirding: Object.keys(seasonsActive).length,
    yearsWithAllMonths: yearsAllMonths,
    preSixChecklists:   Object.keys(preSixSubs).length,
    preEightChecklists: Object.keys(preEightSubs).length,
    stateCount:         Object.keys(states).length,
    countyCount:        Object.keys(counties).length,
    countryCount:       Object.keys(countries).length,
    maxSpeciesInDay:    maxDay,
    pnwCounties:        Object.keys(pnwCounties).length,
    caCounties:         Object.keys(caCounties).length,
    desertCounties:     Object.keys(desertCounties).length,
    txCounties:         Object.keys(txCounties).length,
    flCounties:         Object.keys(flCounties).length,
    rockiesCounties:    Object.keys(rockiesCounties).length,
  };
}

function _parseTimeMins(t) {
  if (!t) return -1;
  var s  = t.trim().toUpperCase();
  var pm = s.indexOf('PM') !== -1, am = s.indexOf('AM') !== -1;
  s = s.replace('AM','').replace('PM','').trim();
  var p = s.split(':');
  if (p.length < 2) return -1;
  var h = parseInt(p[0]), m = parseInt(p[1]) || 0;
  if (isNaN(h)) return -1;
  if (pm && h !== 12) h += 12;
  if (am && h === 12) h  = 0;
  return h * 60 + m;
}

function _nameMatch(speciesSeen, keywords) {
  var n = 0;
  Object.keys(speciesSeen).forEach(function(name) {
    var l = name.toLowerCase();
    if (keywords.some(function(k) { return l.indexOf(k) !== -1; })) n++;
  });
  return n;
}

function _yr(s) {
  return s.bestYearLabel ? 'Best: ' + s.bestYearLabel + ' (' + s.bestYearCount + ' sp)' : '';
}

function evaluateQuests(stats) {
  return QUESTS.map(function(q) {
    var r = q.compute(stats);
    return Object.assign({}, q, {
      earned:   r.earned,
      progress: r.progress,
      total:    r.total,
      detail:   r.detail || '',
    });
  });
}

// ─────────────────────────────────────────────────────────────
// QUEST DEFINITIONS
// ─────────────────────────────────────────────────────────────
var QUESTS = [

  // ══════════════════════════════════════════════════════════
  // 🐦  LIFE LIST
  // ══════════════════════════════════════════════════════════
  { id:'life_1', category:'lifelist', tier:1, icon:'🐦',
    name:'Spark Bird',
    desc:'Record your very first species — the one that starts everything.',
    compute:function(s){ return{earned:s.totalSpecies>=1,   progress:Math.min(s.totalSpecies,1),   total:1};   }},
  { id:'life_2', category:'lifelist', tier:1, icon:'🔟',
    name:'Double Digits',
    desc:'10 species. You can\'t claim you "don\'t really bird" anymore.',
    compute:function(s){ return{earned:s.totalSpecies>=10,  progress:Math.min(s.totalSpecies,10),  total:10};  }},
  { id:'life_3', category:'lifelist', tier:2, icon:'5️⃣',
    name:'Patch Stalker',
    desc:'50 species. You have a local spot. You know the regulars.',
    compute:function(s){ return{earned:s.totalSpecies>=50,  progress:Math.min(s.totalSpecies,50),  total:50};  }},
  { id:'life_4', category:'lifelist', tier:2, icon:'💯',
    name:'The Century',
    desc:'100 life species. Three digits changes things.',
    compute:function(s){ return{earned:s.totalSpecies>=100, progress:Math.min(s.totalSpecies,100), total:100}; }},
  { id:'life_5', category:'lifelist', tier:3, icon:'🌿',
    name:'List Going Long',
    desc:'200 life species. This stopped being a casual hobby a while ago.',
    compute:function(s){ return{earned:s.totalSpecies>=200, progress:Math.min(s.totalSpecies,200), total:200}; }},
  { id:'life_6', category:'lifelist', tier:4, icon:'💎',
    name:'Won\'t Stop Now',
    desc:'300 life species.',
    compute:function(s){ return{earned:s.totalSpecies>=300, progress:Math.min(s.totalSpecies,300), total:300}; }},
  { id:'life_7', category:'lifelist', tier:4, icon:'🔮',
    name:'Still Counting',
    desc:'400 life species. Your friends stopped asking what number you\'re at.',
    compute:function(s){ return{earned:s.totalSpecies>=400, progress:Math.min(s.totalSpecies,400), total:400}; }},
  { id:'life_8', category:'lifelist', tier:5, icon:'👑',
    name:'Five Hundred',
    desc:'500 life species. The number serious listers say reverently.',
    compute:function(s){ return{earned:s.totalSpecies>=500, progress:Math.min(s.totalSpecies,500), total:500}; }},
  { id:'life_9', category:'lifelist', tier:5, icon:'🌟',
    name:'Grinding to a Thousand',
    desc:'750 life species — and you\'ve done the math on what\'s left.',
    compute:function(s){ return{earned:s.totalSpecies>=750, progress:Math.min(s.totalSpecies,750), total:750}; }},

  // ══════════════════════════════════════════════════════════
  // 📋  DEDICATION
  // ══════════════════════════════════════════════════════════
  { id:'ded_1', category:'dedicated', tier:1, icon:'📋',
    name:'Out the Door',
    desc:'Submit your first eBird checklist. The hardest part was starting.',
    compute:function(s){ return{earned:s.totalChecklists>=1,    progress:Math.min(s.totalChecklists,1),    total:1};    }},
  { id:'ded_2', category:'dedicated', tier:1, icon:'📝',
    name:'Habit Forming',
    desc:'10 checklists. You keep going back.',
    compute:function(s){ return{earned:s.totalChecklists>=10,   progress:Math.min(s.totalChecklists,10),   total:10};   }},
  { id:'ded_3', category:'dedicated', tier:2, icon:'📚',
    name:'Known Regular',
    desc:'50 checklists. The birds know your schedule now.',
    compute:function(s){ return{earned:s.totalChecklists>=50,   progress:Math.min(s.totalChecklists,50),   total:50};   }},
  { id:'ded_4', category:'dedicated', tier:2, icon:'📒',
    name:'Patch Addict',
    desc:'100 checklists. This is your third place.',
    compute:function(s){ return{earned:s.totalChecklists>=100,  progress:Math.min(s.totalChecklists,100),  total:100};  }},
  { id:'ded_5', category:'dedicated', tier:3, icon:'📖',
    name:'Filed Away',
    desc:'500 checklists — an actual archive of your life outdoors.',
    compute:function(s){ return{earned:s.totalChecklists>=500,  progress:Math.min(s.totalChecklists,500),  total:500};  }},
  { id:'ded_6', category:'dedicated', tier:4, icon:'🔥',
    name:'Thousand Mornings',
    desc:'1,000 checklists.',
    compute:function(s){ return{earned:s.totalChecklists>=1000, progress:Math.min(s.totalChecklists,1000), total:1000}; }},
  { id:'ded_7', category:'dedicated', tier:4, icon:'🌋',
    name:'Can\'t Stop, Won\'t Stop',
    desc:'2,000 checklists.',
    compute:function(s){ return{earned:s.totalChecklists>=2000, progress:Math.min(s.totalChecklists,2000), total:2000}; }},
  { id:'ded_8', category:'dedicated', tier:5, icon:'⚜️',
    name:'It\'s a Lifestyle',
    desc:'5,000 checklists. No further explanation needed.',
    compute:function(s){ return{earned:s.totalChecklists>=5000, progress:Math.min(s.totalChecklists,5000), total:5000}; }},

  // ══════════════════════════════════════════════════════════
  // 🗺️  GEOGRAPHIC — Counties
  // ══════════════════════════════════════════════════════════
  { id:'geo_co1', category:'geo', tier:1, icon:'🏘️',
    name:'Down the Road',
    desc:'Birded somewhere besides your home county.',
    compute:function(s){ return{earned:s.countyCount>=2,   progress:Math.min(s.countyCount,2),   total:2};   }},
  { id:'geo_co2', category:'geo', tier:2, icon:'🚗',
    name:'Radius Pusher',
    desc:'5 counties. You\'ve started drawing a bigger circle.',
    compute:function(s){ return{earned:s.countyCount>=5,   progress:Math.min(s.countyCount,5),   total:5};   }},
  { id:'geo_co3', category:'geo', tier:3, icon:'🏞️',
    name:'Drawn the Map',
    desc:'10 counties. You think in county lines now.',
    compute:function(s){ return{earned:s.countyCount>=10,  progress:Math.min(s.countyCount,10),  total:10};  }},
  { id:'geo_co4', category:'geo', tier:4, icon:'🗾',
    name:'County Collector',
    desc:'25 counties. Yes, this is a thing people do.',
    compute:function(s){ return{earned:s.countyCount>=25,  progress:Math.min(s.countyCount,25),  total:25};  }},
  { id:'geo_co5', category:'geo', tier:5, icon:'🗺️',
    name:'A Hundred Counties',
    desc:'100 counties. Self-explanatory and deeply impressive.',
    compute:function(s){ return{earned:s.countyCount>=100, progress:Math.min(s.countyCount,100), total:100}; }},

  // 🗺️  GEOGRAPHIC — States / Provinces
  { id:'geo_st1', category:'geo', tier:1, icon:'📍',
    name:'Home Turf',
    desc:'You bird in your home state. It counts.',
    compute:function(s){ return{earned:s.stateCount>=1,  progress:Math.min(s.stateCount,1),  total:1};  }},
  { id:'geo_st2', category:'geo', tier:2, icon:'🗺️',
    name:'Road Tripper',
    desc:'3 states — birding is now an excuse to travel.',
    compute:function(s){ return{earned:s.stateCount>=3,  progress:Math.min(s.stateCount,3),  total:3};  }},
  { id:'geo_st3', category:'geo', tier:3, icon:'✈️',
    name:'State Lines Don\'t Stop Me',
    desc:'5 states or provinces.',
    compute:function(s){ return{earned:s.stateCount>=5,  progress:Math.min(s.stateCount,5),  total:5};  }},
  { id:'geo_st4', category:'geo', tier:4, icon:'🌐',
    name:'Ten States Deep',
    desc:'10 states. You plan trips around eBird hotspot maps.',
    compute:function(s){ return{earned:s.stateCount>=10, progress:Math.min(s.stateCount,10), total:10}; }},
  { id:'geo_st5', category:'geo', tier:5, icon:'🌎',
    name:'The Continental',
    desc:'30 states or provinces. You\'ve covered serious ground.',
    compute:function(s){ return{earned:s.stateCount>=30, progress:Math.min(s.stateCount,30), total:30}; }},

  // 🗺️  GEOGRAPHIC — Countries
  { id:'geo_ct1', category:'geo', tier:1, icon:'🏠',
    name:'Home Waters',
    desc:'Submit a checklist in your home country.',
    compute:function(s){ return{earned:s.countryCount>=1,  progress:Math.min(s.countryCount,1),  total:1};  }},
  { id:'geo_ct2', category:'geo', tier:2, icon:'🛂',
    name:'Crossed a Border',
    desc:'2 countries — even if it was just Canada.',
    compute:function(s){ return{earned:s.countryCount>=2,  progress:Math.min(s.countryCount,2),  total:2};  }},
  { id:'geo_ct3', category:'geo', tier:3, icon:'🌍',
    name:'International Incident',
    desc:'3 countries. Someone on your trip asked why you kept stopping.',
    compute:function(s){ return{earned:s.countryCount>=3,  progress:Math.min(s.countryCount,3),  total:3};  }},
  { id:'geo_ct4', category:'geo', tier:4, icon:'🌏',
    name:'Frequent Flyer',
    desc:'5 countries. Your luggage has binoculars dents.',
    compute:function(s){ return{earned:s.countryCount>=5,  progress:Math.min(s.countryCount,5),  total:5};  }},
  { id:'geo_ct5', category:'geo', tier:5, icon:'🌐',
    name:'Citizen of Everywhere',
    desc:'10 or more countries.',
    compute:function(s){ return{earned:s.countryCount>=10, progress:Math.min(s.countryCount,10), total:10}; }},

  // ══════════════════════════════════════════════════════════
  // ⏰  TEMPORAL — Big Day
  // ══════════════════════════════════════════════════════════
  { id:'tmp_bd1', category:'temporal', tier:1, icon:'☀️',
    name:'Good Day Out',
    desc:'10 species in a single day.',
    compute:function(s){ return{earned:s.maxSpeciesInDay>=10,  progress:Math.min(s.maxSpeciesInDay,10),  total:10,  detail:'Your best: '+s.maxSpeciesInDay+' sp'}; }},
  { id:'tmp_bd2', category:'temporal', tier:2, icon:'🌤️',
    name:'That Was a Good Morning',
    desc:'25 species in a day. Done before lunch.',
    compute:function(s){ return{earned:s.maxSpeciesInDay>=25,  progress:Math.min(s.maxSpeciesInDay,25),  total:25,  detail:'Your best: '+s.maxSpeciesInDay+' sp'}; }},
  { id:'tmp_bd3', category:'temporal', tier:3, icon:'🦅',
    name:'Skipped Breakfast',
    desc:'50 species in a day. You were at the marsh at 5am.',
    compute:function(s){ return{earned:s.maxSpeciesInDay>=50,  progress:Math.min(s.maxSpeciesInDay,50),  total:50,  detail:'Your best: '+s.maxSpeciesInDay+' sp'}; }},
  { id:'tmp_bd4', category:'temporal', tier:4, icon:'🏆',
    name:'Why Am I Like This',
    desc:'75 species in a day. Your friends don\'t ask where you were.',
    compute:function(s){ return{earned:s.maxSpeciesInDay>=75,  progress:Math.min(s.maxSpeciesInDay,75),  total:75,  detail:'Your best: '+s.maxSpeciesInDay+' sp'}; }},
  { id:'tmp_bd5', category:'temporal', tier:5, icon:'💥',
    name:'No Plans That Day',
    desc:'100 species in a single day. You planned nothing else.',
    compute:function(s){ return{earned:s.maxSpeciesInDay>=100, progress:Math.min(s.maxSpeciesInDay,100), total:100, detail:'Your best: '+s.maxSpeciesInDay+' sp'}; }},

  // ⏰  TEMPORAL — Dawn Birding
  { id:'tmp_dw1', category:'temporal', tier:1, icon:'🌅',
    name:'Early Bird',
    desc:'Submit a checklist started before 8 AM.',
    compute:function(s){ return{earned:s.preEightChecklists>=1,  progress:Math.min(s.preEightChecklists,1),  total:1};   }},
  { id:'tmp_dw2', category:'temporal', tier:2, icon:'🌄',
    name:'Alarm Before Dawn',
    desc:'First checklist started before 6 AM.',
    compute:function(s){ return{earned:s.preSixChecklists>=1,    progress:Math.min(s.preSixChecklists,1),    total:1};   }},
  { id:'tmp_dw3', category:'temporal', tier:3, icon:'🌠',
    name:'Dawn Chorus Regular',
    desc:'25 checklists before 6 AM. You know when the robins start.',
    compute:function(s){ return{earned:s.preSixChecklists>=25,   progress:Math.min(s.preSixChecklists,25),   total:25};  }},
  { id:'tmp_dw4', category:'temporal', tier:4, icon:'🌟',
    name:'Chronically Early',
    desc:'100 pre-dawn checklists.',
    compute:function(s){ return{earned:s.preSixChecklists>=100,  progress:Math.min(s.preSixChecklists,100),  total:100}; }},
  { id:'tmp_dw5', category:'temporal', tier:5, icon:'🦉',
    name:'Sleep Is for January',
    desc:'500 checklists before 6 AM. The dark isn\'t a deterrent.',
    compute:function(s){ return{earned:s.preSixChecklists>=500,  progress:Math.min(s.preSixChecklists,500),  total:500}; }},

  // ⏰  TEMPORAL — Seasonal Consistency
  { id:'tmp_se1', category:'temporal', tier:1, icon:'🌸',
    name:'Not Just Spring',
    desc:'Bird in at least 2 different seasons.',
    compute:function(s){ return{earned:s.seasonsWithBirding>=2, progress:s.seasonsWithBirding, total:2}; }},
  { id:'tmp_se2', category:'temporal', tier:2, icon:'🍂',
    name:'All Year Round',
    desc:'Bird in all four seasons — winter, spring, summer, fall.',
    compute:function(s){ return{earned:s.seasonsWithBirding>=4, progress:s.seasonsWithBirding, total:4}; }},
  { id:'tmp_se3', category:'temporal', tier:3, icon:'📅',
    name:'Every Month Club',
    desc:'Submit at least one checklist in every month of the year.',
    compute:function(s){ return{earned:s.activeMonths>=12, progress:s.activeMonths, total:12}; }},
  { id:'tmp_se4', category:'temporal', tier:4, icon:'☔',
    name:'Rain or Shine',
    desc:'All 12 months completed in 2 different calendar years.',
    compute:function(s){ return{earned:s.yearsWithAllMonths>=2, progress:Math.min(s.yearsWithAllMonths,2), total:2}; }},
  { id:'tmp_se5', category:'temporal', tier:5, icon:'♾️',
    name:'No Off-Season',
    desc:'All 12 months completed in 5 or more calendar years.',
    compute:function(s){ return{earned:s.yearsWithAllMonths>=5, progress:Math.min(s.yearsWithAllMonths,5), total:5}; }},

  // ⏰  TEMPORAL — Year List
  { id:'tmp_yr1', category:'temporal', tier:1, icon:'🗓️',
    name:'Year\'s Off to a Good Start',
    desc:'25 species in a single calendar year.',
    compute:function(s){ return{earned:s.bestYearCount>=25,  progress:Math.min(s.bestYearCount,25),  total:25,  detail:_yr(s)}; }},
  { id:'tmp_yr2', category:'temporal', tier:2, icon:'💯',
    name:'Century Year',
    desc:'100 species in one calendar year.',
    compute:function(s){ return{earned:s.bestYearCount>=100, progress:Math.min(s.bestYearCount,100), total:100, detail:_yr(s)}; }},
  { id:'tmp_yr3', category:'temporal', tier:3, icon:'📈',
    name:'Getting Serious',
    desc:'150 species in one year.',
    compute:function(s){ return{earned:s.bestYearCount>=150, progress:Math.min(s.bestYearCount,150), total:150, detail:_yr(s)}; }},
  { id:'tmp_yr4', category:'temporal', tier:4, icon:'🎯',
    name:'The Year Lister',
    desc:'200 species in one year. You made a spreadsheet for this.',
    compute:function(s){ return{earned:s.bestYearCount>=200, progress:Math.min(s.bestYearCount,200), total:200, detail:_yr(s)}; }},
  { id:'tmp_yr5', category:'temporal', tier:5, icon:'⚡',
    name:'The Big Year',
    desc:'300 species in one year. The movie was based on people like you.',
    compute:function(s){ return{earned:s.bestYearCount>=300, progress:Math.min(s.bestYearCount,300), total:300, detail:_yr(s)}; }},

  // ══════════════════════════════════════════════════════════
  // 🔬  SPECIES EXPLORER
  // Thresholds calibrated to NA species totals.
  // Phase 1: common-name keyword matching.
  // ══════════════════════════════════════════════════════════

  // — Owls (19 NA species) —
  { id:'sp_owl1', category:'species', tier:1, icon:'🦉', name:'Who\'s There?',
    desc:'See your first owl species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['owl','owlet']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_owl2', category:'species', tier:2, icon:'🦉', name:'Night Shift',
    desc:'See 3 owl species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['owl','owlet']); return{earned:n>=3, progress:Math.min(n,3),  total:3};  }},
  { id:'sp_owl3', category:'species', tier:3, icon:'🦉', name:'Owling Regular',
    desc:'7 owl species. You\'ve gone out at night on purpose.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['owl','owlet']); return{earned:n>=7, progress:Math.min(n,7),  total:7};  }},
  { id:'sp_owl4', category:'species', tier:4, icon:'🦉', name:'Night Vision',
    desc:'12 owl species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['owl','owlet']); return{earned:n>=12,progress:Math.min(n,12), total:12}; }},
  { id:'sp_owl5', category:'species', tier:5, icon:'🦉', name:'Hoots to Give',
    desc:'16 of the 19 NA owl species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['owl','owlet']); return{earned:n>=16,progress:Math.min(n,16), total:16}; }},

  // — Raptors (35 NA species) —
  { id:'sp_rap1', category:'species', tier:1, icon:'🦅', name:'Looks Up',
    desc:'Your first hawk, eagle, falcon, osprey, or vulture.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hawk','eagle','falcon','osprey','harrier','kite','vulture','condor','merlin','kestrel']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_rap2', category:'species', tier:2, icon:'🦅', name:'Neck Craner',
    desc:'5 raptor species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hawk','eagle','falcon','osprey','harrier','kite','vulture','condor','merlin','kestrel']); return{earned:n>=5, progress:Math.min(n,5),  total:5};  }},
  { id:'sp_rap3', category:'species', tier:3, icon:'🦅', name:'Hawkwatch Devotee',
    desc:'12 raptor species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hawk','eagle','falcon','osprey','harrier','kite','vulture','condor','merlin','kestrel']); return{earned:n>=12,progress:Math.min(n,12), total:12}; }},
  { id:'sp_rap4', category:'species', tier:4, icon:'🦅', name:'Everything Soars',
    desc:'20 raptor species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hawk','eagle','falcon','osprey','harrier','kite','vulture','condor','merlin','kestrel']); return{earned:n>=20,progress:Math.min(n,20), total:20}; }},
  { id:'sp_rap5', category:'species', tier:5, icon:'🦅', name:'Raptor Obsessed',
    desc:'28 raptor species. You own a scope just for hawkwatching.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hawk','eagle','falcon','osprey','harrier','kite','vulture','condor','merlin','kestrel']); return{earned:n>=28,progress:Math.min(n,28), total:28}; }},

  // — Waterfowl (50+ NA species) —
  { id:'sp_wf1', category:'species', tier:1, icon:'🦆', name:'Pond Visitor',
    desc:'Your first duck, goose, or swan.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['duck','teal','goose','geese','swan','merganser','scoter','scaup','bufflehead','goldeneye','pintail','wigeon','shoveler','canvasback','redhead','mallard','gadwall','eider']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_wf2', category:'species', tier:2, icon:'🦆', name:'Duck Season',
    desc:'10 waterfowl species — the good kind of duck season.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['duck','teal','goose','geese','swan','merganser','scoter','scaup','bufflehead','goldeneye','pintail','wigeon','shoveler','canvasback','redhead','mallard','gadwall','eider']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_wf3', category:'species', tier:3, icon:'🦆', name:'Knows Their Ducks',
    desc:'20 waterfowl species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['duck','teal','goose','geese','swan','merganser','scoter','scaup','bufflehead','goldeneye','pintail','wigeon','shoveler','canvasback','redhead','mallard','gadwall','eider']); return{earned:n>=20,progress:Math.min(n,20), total:20}; }},
  { id:'sp_wf4', category:'species', tier:4, icon:'🦆', name:'Works the Ponds',
    desc:'30 waterfowl species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['duck','teal','goose','geese','swan','merganser','scoter','scaup','bufflehead','goldeneye','pintail','wigeon','shoveler','canvasback','redhead','mallard','gadwall','eider']); return{earned:n>=30,progress:Math.min(n,30), total:30}; }},
  { id:'sp_wf5', category:'species', tier:5, icon:'🦆', name:'Wetland Devotee',
    desc:'40 waterfowl species. You own waders.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['duck','teal','goose','geese','swan','merganser','scoter','scaup','bufflehead','goldeneye','pintail','wigeon','shoveler','canvasback','redhead','mallard','gadwall','eider']); return{earned:n>=40,progress:Math.min(n,40), total:40}; }},

  // — Warblers (54 NA species) —
  { id:'sp_wa1', category:'species', tier:1, icon:'🐤', name:'Spring Is Here',
    desc:'3 warbler species. You noticed they were back.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['warbler','ovenbird','waterthrush','yellowthroat','redstart','chat']); return{earned:n>=3, progress:Math.min(n,3),  total:3};  }},
  { id:'sp_wa2', category:'species', tier:2, icon:'🐤', name:'Warbler Neck',
    desc:'10 warblers — a very real condition from staring up at the canopy.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['warbler','ovenbird','waterthrush','yellowthroat','redstart','chat']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_wa3', category:'species', tier:3, icon:'🐤', name:'May Obsession',
    desc:'20 warbler species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['warbler','ovenbird','waterthrush','yellowthroat','redstart','chat']); return{earned:n>=20,progress:Math.min(n,20), total:20}; }},
  { id:'sp_wa4', category:'species', tier:4, icon:'🐤', name:'Warbler Fever',
    desc:'30 warbler species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['warbler','ovenbird','waterthrush','yellowthroat','redstart','chat']); return{earned:n>=30,progress:Math.min(n,30), total:30}; }},
  { id:'sp_wa5', category:'species', tier:5, icon:'🐤', name:'Confusing Fall Warbler',
    desc:'42 warbler species. You understand why that Peterson\'s plate exists.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['warbler','ovenbird','waterthrush','yellowthroat','redstart','chat']); return{earned:n>=42,progress:Math.min(n,42), total:42}; }},

  // — Shorebirds (60+ NA species) —
  { id:'sp_sh1', category:'species', tier:1, icon:'🐦', name:'Mudflat Curious',
    desc:'3 shorebird species. You stopped at the mudflat.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sandpiper','plover','snipe','dowitcher','godwit','dunlin','phalarope','turnstone','yellowlegs','knot','curlew','whimbrel','willet','oystercatcher','avocet','stilt','tattler']); return{earned:n>=3, progress:Math.min(n,3),  total:3};  }},
  { id:'sp_sh2', category:'species', tier:2, icon:'🐦', name:'Peep Starer',
    desc:'10 shorebirds. Peeps are the small sandpipers everyone squints at.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sandpiper','plover','snipe','dowitcher','godwit','dunlin','phalarope','turnstone','yellowlegs','knot','curlew','whimbrel','willet','oystercatcher','avocet','stilt','tattler']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_sh3', category:'species', tier:3, icon:'🐦', name:'Spotting Scope Required',
    desc:'20 shorebird species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sandpiper','plover','snipe','dowitcher','godwit','dunlin','phalarope','turnstone','yellowlegs','knot','curlew','whimbrel','willet','oystercatcher','avocet','stilt','tattler']); return{earned:n>=20,progress:Math.min(n,20), total:20}; }},
  { id:'sp_sh4', category:'species', tier:4, icon:'🐦', name:'Shorebird Person',
    desc:'30 species. People know to call you when something appears.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sandpiper','plover','snipe','dowitcher','godwit','dunlin','phalarope','turnstone','yellowlegs','knot','curlew','whimbrel','willet','oystercatcher','avocet','stilt','tattler']); return{earned:n>=30,progress:Math.min(n,30), total:30}; }},
  { id:'sp_sh5', category:'species', tier:5, icon:'🐦', name:'Works the Tide',
    desc:'45 shorebird species. You plan around tide tables.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sandpiper','plover','snipe','dowitcher','godwit','dunlin','phalarope','turnstone','yellowlegs','knot','curlew','whimbrel','willet','oystercatcher','avocet','stilt','tattler']); return{earned:n>=45,progress:Math.min(n,45), total:45}; }},

  // — Sparrows (35 NA species) —
  { id:'sp_sp1', category:'species', tier:1, icon:'🐦', name:'LBJ Spotter',
    desc:'3 sparrow species. LBJ: Little Brown Job — what you call the sparrow you can\'t quite ID.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sparrow','junco','towhee']); return{earned:n>=3, progress:Math.min(n,3),  total:3};  }},
  { id:'sp_sp2', category:'species', tier:2, icon:'🐦', name:'Brown Bird Believer',
    desc:'8 sparrow species. You don\'t call them "just a sparrow" anymore.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sparrow','junco','towhee']); return{earned:n>=8, progress:Math.min(n,8),  total:8};  }},
  { id:'sp_sp3', category:'species', tier:3, icon:'🐦', name:'Sparrow Head',
    desc:'15 sparrow species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sparrow','junco','towhee']); return{earned:n>=15,progress:Math.min(n,15), total:15}; }},
  { id:'sp_sp4', category:'species', tier:4, icon:'🐦', name:'Every Brown Bird Counts',
    desc:'22 sparrow species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sparrow','junco','towhee']); return{earned:n>=22,progress:Math.min(n,22), total:22}; }},
  { id:'sp_sp5', category:'species', tier:5, icon:'🐦', name:'Sees Every Sparrow',
    desc:'30 sparrow species. You stop for every fencepost.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['sparrow','junco','towhee']); return{earned:n>=30,progress:Math.min(n,30), total:30}; }},

  // — Hummingbirds (17 NA species) —
  { id:'sp_hu1', category:'species', tier:1, icon:'🌺', name:'There It Is',
    desc:'Your first hummingbird.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hummingbird','sabrewing','emerald','coquette','mango','woodnymph']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_hu2', category:'species', tier:2, icon:'🌺', name:'Feeder Watcher',
    desc:'3 hummingbird species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hummingbird','sabrewing','emerald','coquette','mango','woodnymph']); return{earned:n>=3, progress:Math.min(n,3),  total:3};  }},
  { id:'sp_hu3', category:'species', tier:3, icon:'🌺', name:'Southwest Bound',
    desc:'6 hummingbird species. You\'ve made the trip.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hummingbird','sabrewing','emerald','coquette','mango','woodnymph']); return{earned:n>=6, progress:Math.min(n,6),  total:6};  }},
  { id:'sp_hu4', category:'species', tier:4, icon:'🌺', name:'The Hummingbird Chase',
    desc:'10 hummingbird species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hummingbird','sabrewing','emerald','coquette','mango','woodnymph']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_hu5', category:'species', tier:5, icon:'🌺', name:'Ruby-Throated and Beyond',
    desc:'14 species. You\'ve seen most of what North America offers.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['hummingbird','sabrewing','emerald','coquette','mango','woodnymph']); return{earned:n>=14,progress:Math.min(n,14), total:14}; }},

  // — Woodpeckers (23 NA species) —
  { id:'sp_wp1', category:'species', tier:1, icon:'🌳', name:'Heard It First',
    desc:'Your first woodpecker. You heard it before you saw it.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['woodpecker','sapsucker','flicker']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_wp2', category:'species', tier:2, icon:'🌳', name:'Drumline Fan',
    desc:'5 woodpecker species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['woodpecker','sapsucker','flicker']); return{earned:n>=5, progress:Math.min(n,5),  total:5};  }},
  { id:'sp_wp3', category:'species', tier:3, icon:'🌳', name:'Dead Tree Devotee',
    desc:'10 woodpecker species. You scan every snag.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['woodpecker','sapsucker','flicker']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_wp4', category:'species', tier:4, icon:'🌳', name:'Snag Seeker',
    desc:'15 woodpecker species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['woodpecker','sapsucker','flicker']); return{earned:n>=15,progress:Math.min(n,15), total:15}; }},
  { id:'sp_wp5', category:'species', tier:5, icon:'🌳', name:'Every Knock Matters',
    desc:'20 of the 23 NA woodpecker species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['woodpecker','sapsucker','flicker']); return{earned:n>=20,progress:Math.min(n,20), total:20}; }},

  // — Gulls (23 NA species) —
  { id:'sp_gu1', category:'species', tier:1, icon:'🌊', name:'Parking Lot Bird',
    desc:'Your first gull. Every birder starts here.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['gull','kittiwake']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_gu2', category:'species', tier:2, icon:'🌊', name:'They\'re Not All Herring Gulls',
    desc:'5 gull species. You\'ve started looking at legs and wingtips.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['gull','kittiwake']); return{earned:n>=5, progress:Math.min(n,5),  total:5};  }},
  { id:'sp_gu3', category:'species', tier:3, icon:'🌊', name:'Larophile Apprentice',
    desc:'10 gull species. Larophile: someone obsessed with gulls.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['gull','kittiwake']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_gu4', category:'species', tier:4, icon:'🌊', name:'Larophile',
    desc:'15 gull species. You carry Howell & Dunn in your field bag.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['gull','kittiwake']); return{earned:n>=15,progress:Math.min(n,15), total:15}; }},
  { id:'sp_gu5', category:'species', tier:5, icon:'🌊', name:'Reads the Wing Tips',
    desc:'20 of the 23 NA gull species. Third-cycle plumage holds no mystery.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['gull','kittiwake']); return{earned:n>=20,progress:Math.min(n,20), total:20}; }},

  // — Flycatchers (35 regular NA species) —
  { id:'sp_fl1', category:'species', tier:1, icon:'🪲', name:'Basic Phoebe',
    desc:'Your first flycatcher. Probably an Eastern Phoebe.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['flycatcher','phoebe','kingbird','pewee','kiskadee']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_fl2', category:'species', tier:2, icon:'🪲', name:'Wait, Which One?',
    desc:'5 flycatcher species. You\'ve met the Empidonax problem.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['flycatcher','phoebe','kingbird','pewee','kiskadee']); return{earned:n>=5, progress:Math.min(n,5),  total:5};  }},
  { id:'sp_fl3', category:'species', tier:3, icon:'🪲', name:'Empid Curious',
    desc:'10 flycatcher species. Empidonax is nearly impossible without song.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['flycatcher','phoebe','kingbird','pewee','kiskadee']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_fl4', category:'species', tier:4, icon:'🪲', name:'Empid Nightmare',
    desc:'20 flycatcher species. You argue about vocalizations online.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['flycatcher','phoebe','kingbird','pewee','kiskadee']); return{earned:n>=20,progress:Math.min(n,20), total:20}; }},
  { id:'sp_fl5', category:'species', tier:5, icon:'🪲', name:'Makes Peace with Uncertainty',
    desc:'28 flycatcher species. Some will stay unidentified. You\'re okay with that.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['flycatcher','phoebe','kingbird','pewee','kiskadee']); return{earned:n>=28,progress:Math.min(n,28), total:28}; }},

  // — Herons & Egrets (12 NA species) —
  { id:'sp_he1', category:'species', tier:1, icon:'🪶', name:'Standing Water',
    desc:'Your first heron or egret.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['heron','egret','bittern','night-heron']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_he2', category:'species', tier:2, icon:'🪶', name:'Great Blue Regular',
    desc:'3 heron or egret species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['heron','egret','bittern','night-heron']); return{earned:n>=3, progress:Math.min(n,3),  total:3};  }},
  { id:'sp_he3', category:'species', tier:3, icon:'🪶', name:'Heron Patrol',
    desc:'6 heron or egret species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['heron','egret','bittern','night-heron']); return{earned:n>=6, progress:Math.min(n,6),  total:6};  }},
  { id:'sp_he4', category:'species', tier:4, icon:'🪶', name:'Wading Obsession',
    desc:'9 heron or egret species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['heron','egret','bittern','night-heron']); return{earned:n>=9, progress:Math.min(n,9),  total:9};  }},
  { id:'sp_he5', category:'species', tier:5, icon:'🪶', name:'All the Herons',
    desc:'All 12 NA heron and egret species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['heron','egret','bittern','night-heron']); return{earned:n>=12,progress:Math.min(n,12), total:12}; }},

  // ══════════════════════════════════════════════════════════
  // 🌎  REGIONAL — depth within specific geographic regions
  // ══════════════════════════════════════════════════════════

  // — Pacific Northwest (OR + WA = 75 counties) —
  { id:'reg_pnw1', category:'regional', tier:1, icon:'🌲', name:'Smells Like Rain',
    desc:'2 PNW counties (Oregon or Washington). You\'ve been here. You know.',
    compute:function(s){ return{earned:s.pnwCounties>=2,  progress:Math.min(s.pnwCounties,2),  total:2};  }},
  { id:'reg_pnw2', category:'regional', tier:2, icon:'🌲', name:'Cascade Crosser',
    desc:'8 PNW counties — you\'ve birded both sides of the mountains.',
    compute:function(s){ return{earned:s.pnwCounties>=8,  progress:Math.min(s.pnwCounties,8),  total:8};  }},
  { id:'reg_pnw3', category:'regional', tier:3, icon:'🌲', name:'Knows the Peninsula',
    desc:'20 PNW counties. Olympic, Klamath, coast — you\'ve done the work.',
    compute:function(s){ return{earned:s.pnwCounties>=20, progress:Math.min(s.pnwCounties,20), total:20}; }},
  { id:'reg_pnw4', category:'regional', tier:4, icon:'🌲', name:'Oregon Trailed',
    desc:'40 PNW counties.',
    compute:function(s){ return{earned:s.pnwCounties>=40, progress:Math.min(s.pnwCounties,40), total:40}; }},
  { id:'reg_pnw5', category:'regional', tier:5, icon:'🌲', name:'Moss-Covered Lister',
    desc:'65 of 75 PNW counties. You are the PNW.',
    compute:function(s){ return{earned:s.pnwCounties>=65, progress:Math.min(s.pnwCounties,65), total:65}; }},

  // — California (58 counties) —
  { id:'reg_ca1', category:'regional', tier:1, icon:'☀️', name:'California Dreamin\'',
    desc:'2 California counties. You made it.',
    compute:function(s){ return{earned:s.caCounties>=2,  progress:Math.min(s.caCounties,2),  total:2};  }},
  { id:'reg_ca2', category:'regional', tier:2, icon:'☀️', name:'Beyond the Bay',
    desc:'8 CA counties — you left the coast bubble.',
    compute:function(s){ return{earned:s.caCounties>=8,  progress:Math.min(s.caCounties,8),  total:8};  }},
  { id:'reg_ca3', category:'regional', tier:3, icon:'☀️', name:'Central Valley Run',
    desc:'20 CA counties. The Central Valley is the underrated gem of CA birding.',
    compute:function(s){ return{earned:s.caCounties>=20, progress:Math.min(s.caCounties,20), total:20}; }},
  { id:'reg_ca4', category:'regional', tier:4, icon:'☀️', name:'Knows the Coast Highway',
    desc:'40 CA counties. You\'ve pulled over for shorebirds more than once.',
    compute:function(s){ return{earned:s.caCounties>=40, progress:Math.min(s.caCounties,40), total:40}; }},
  { id:'reg_ca5', category:'regional', tier:5, icon:'☀️', name:'All 58',
    desc:'55 of California\'s 58 counties. The CA county list dream.',
    compute:function(s){ return{earned:s.caCounties>=55, progress:Math.min(s.caCounties,55), total:55}; }},

  // — Desert Southwest (AZ + NV + UT + NM = 94 counties) —
  { id:'reg_ds1', category:'regional', tier:1, icon:'🏜️', name:'Heard a Cactus Wren',
    desc:'1 desert county. Welcome to the Sonoran.',
    compute:function(s){ return{earned:s.desertCounties>=1,  progress:Math.min(s.desertCounties,1),  total:1};  }},
  { id:'reg_ds2', category:'regional', tier:2, icon:'🏜️', name:'Roadrunner Country',
    desc:'5 desert counties. You\'ve chased something in the heat.',
    compute:function(s){ return{earned:s.desertCounties>=5,  progress:Math.min(s.desertCounties,5),  total:5};  }},
  { id:'reg_ds3', category:'regional', tier:3, icon:'🏜️', name:'Knows the Washes',
    desc:'15 desert counties. That\'s where the birds hide.',
    compute:function(s){ return{earned:s.desertCounties>=15, progress:Math.min(s.desertCounties,15), total:15}; }},
  { id:'reg_ds4', category:'regional', tier:4, icon:'🏜️', name:'Painted Desert Regular',
    desc:'35 desert counties. You plan trips around the monsoon season.',
    compute:function(s){ return{earned:s.desertCounties>=35, progress:Math.min(s.desertCounties,35), total:35}; }},
  { id:'reg_ds5', category:'regional', tier:5, icon:'🏜️', name:'Desert Soul',
    desc:'65 desert counties across AZ, NV, UT, and NM.',
    compute:function(s){ return{earned:s.desertCounties>=65, progress:Math.min(s.desertCounties,65), total:65}; }},

  // — Texas (254 counties) —
  { id:'reg_tx1', category:'regional', tier:1, icon:'🤠', name:'Heard a Mockingbird',
    desc:'2 Texas counties. Texas state bird, Texas state of mind.',
    compute:function(s){ return{earned:s.txCounties>=2,   progress:Math.min(s.txCounties,2),   total:2};   }},
  { id:'reg_tx2', category:'regional', tier:2, icon:'🤠', name:'Coast to Hill Country',
    desc:'10 TX counties — you\'ve sampled more than one biome.',
    compute:function(s){ return{earned:s.txCounties>=10,  progress:Math.min(s.txCounties,10),  total:10};  }},
  { id:'reg_tx3', category:'regional', tier:3, icon:'🤠', name:'Trans-Pecos Dreamer',
    desc:'30 TX counties. The far west is calling.',
    compute:function(s){ return{earned:s.txCounties>=30,  progress:Math.min(s.txCounties,30),  total:30};  }},
  { id:'reg_tx4', category:'regional', tier:4, icon:'🤠', name:'Big Bend Regular',
    desc:'75 TX counties. You\'ve made the drive.',
    compute:function(s){ return{earned:s.txCounties>=75,  progress:Math.min(s.txCounties,75),  total:75};  }},
  { id:'reg_tx5', category:'regional', tier:5, icon:'🤠', name:'Deep in the Heart',
    desc:'150 Texas counties. It\'s big. You know.',
    compute:function(s){ return{earned:s.txCounties>=150, progress:Math.min(s.txCounties,150), total:150}; }},

  // — Florida (67 counties) —
  { id:'reg_fl1', category:'regional', tier:1, icon:'🦩', name:'Florida Man, Birder Edition',
    desc:'2 Florida counties. Unexplainable birds await.',
    compute:function(s){ return{earned:s.flCounties>=2,  progress:Math.min(s.flCounties,2),  total:2};  }},
  { id:'reg_fl2', category:'regional', tier:2, icon:'🦩', name:'Saw a Spoonbill',
    desc:'8 FL counties — you\'ve had the experience.',
    compute:function(s){ return{earned:s.flCounties>=8,  progress:Math.min(s.flCounties,8),  total:8};  }},
  { id:'reg_fl3', category:'regional', tier:3, icon:'🦩', name:'Both Coasts',
    desc:'20 FL counties. Gulf and Atlantic — different birds, both excellent.',
    compute:function(s){ return{earned:s.flCounties>=20, progress:Math.min(s.flCounties,20), total:20}; }},
  { id:'reg_fl4', category:'regional', tier:4, icon:'🦩', name:'Knows the Keys',
    desc:'40 FL counties.',
    compute:function(s){ return{earned:s.flCounties>=40, progress:Math.min(s.flCounties,40), total:40}; }},
  { id:'reg_fl5', category:'regional', tier:5, icon:'🦩', name:'All 67',
    desc:'60 of Florida\'s 67 counties. You\'ve birded the whole peninsula.',
    compute:function(s){ return{earned:s.flCounties>=60, progress:Math.min(s.flCounties,60), total:60}; }},

  // — Rocky Mountains (CO + ID + MT + WY = 187 counties) —
  { id:'reg_rm1', category:'regional', tier:1, icon:'⛰️', name:'Above Treeline',
    desc:'2 Rockies counties. The altitude hits different.',
    compute:function(s){ return{earned:s.rockiesCounties>=2,   progress:Math.min(s.rockiesCounties,2),   total:2};   }},
  { id:'reg_rm2', category:'regional', tier:2, icon:'⛰️', name:'Mountain Birder',
    desc:'10 Rockies counties.',
    compute:function(s){ return{earned:s.rockiesCounties>=10,  progress:Math.min(s.rockiesCounties,10),  total:10};  }},
  { id:'reg_rm3', category:'regional', tier:3, icon:'⛰️', name:'High Country Regular',
    desc:'30 Rockies counties. You\'ve chased rosy-finches.',
    compute:function(s){ return{earned:s.rockiesCounties>=30,  progress:Math.min(s.rockiesCounties,30),  total:30};  }},
  { id:'reg_rm4', category:'regional', tier:4, icon:'⛰️', name:'Summit Lister',
    desc:'70 Rockies counties.',
    compute:function(s){ return{earned:s.rockiesCounties>=70,  progress:Math.min(s.rockiesCounties,70),  total:70};  }},
  { id:'reg_rm5', category:'regional', tier:5, icon:'⛰️', name:'The Rockies Run',
    desc:'140 Rockies counties across CO, ID, MT, and WY.',
    compute:function(s){ return{earned:s.rockiesCounties>=140, progress:Math.min(s.rockiesCounties,140), total:140}; }},

];
