// ─────────────────────────────────────────────────────────────
// OnlyBirdNerds — Quest & Badge System  v2 Expansion
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
  { id: 'onramp',    label: 'On-Ramp',     icon: '🌱' },
  { id: 'quirk',     label: 'Quirk',       icon: '🎲' },
  { id: 'pnw_pack',  label: 'PNW Pack',    icon: '🌲' },
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
  var pnwCounties     = {};
  var caCounties      = {};
  var desertCounties  = {};
  var txCounties      = {};
  var flCounties      = {};
  var rockiesCounties = {};

  // v2 accumulators
  var locationSubIds   = {};  // location → { subId: true }
  var speciesSubIds    = {};  // name → { subId: true }
  var locationMonths   = {};  // location → { month: true }
  var janFirstYears    = {};  // year → true
  var midnightSubs     = {};  // subId → true (00:00–02:59)
  var migYearSp        = {};  // year → { name: true } (Apr+May only)
  var winterSeasSp     = {};  // "Y1-Y2" → { name: true }
  var breedingSp       = {};  // name → true
  var subIdAllObs      = {};  // subId → bool
  var subIdHasX        = {};  // subId → true if any row has count 'X'
  var subIdDuration    = {};  // subId → duration (min)
  var subIdDistance    = {};  // subId → distance (km)
  var subIdProtocol    = {};  // subId → protocol string
  var dippersCreedSubs = {};  // subId → true (contains American Dipper)
  var malheurSubs      = {};  // subId → true
  var speciesCommentRows = 0;
  var hasLeap          = false;
  var heardOnlySpecies = {};
  var countySpeciesMap = {};

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
      if (!countySpeciesMap[countyKey]) countySpeciesMap[countyKey] = {};
      countySpeciesMap[countyKey][r.name] = true;
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
      if (mins >= 0 && mins < 180) midnightSubs[r.subId] = true;
    }

    // v2: location loyalty + phenology
    if (r.location && r.subId) {
      if (!locationSubIds[r.location]) locationSubIds[r.location] = {};
      locationSubIds[r.location][r.subId] = true;
      if (r.month) {
        if (!locationMonths[r.location]) locationMonths[r.location] = {};
        locationMonths[r.location][r.month] = true;
      }
    }

    // v2: species loyalty
    if (r.name && r.subId) {
      if (!speciesSubIds[r.name]) speciesSubIds[r.name] = {};
      speciesSubIds[r.name][r.subId] = true;
    }

    // v2: Jan 1 streak
    if (r.month === 1 && r.day === 1 && r.year) janFirstYears[r.year] = true;

    // v2: Leap Lister
    if (r.month === 2 && r.day === 29) hasLeap = true;

    // v2: Migration Rider (Apr + May)
    if (r.year && (r.month === 4 || r.month === 5)) {
      if (!migYearSp[r.year]) migYearSp[r.year] = {};
      migYearSp[r.year][r.name] = true;
    }

    // v2: Winter Holdout (Dec of year Y + Jan of year Y+1 = winter Y/Y+1)
    if (r.year && (r.month === 12 || r.month === 1)) {
      var wk = r.month === 12
        ? (r.year + '-' + (parseInt(r.year) + 1))
        : ((parseInt(r.year) - 1) + '-' + r.year);
      if (!winterSeasSp[wk]) winterSeasSp[wk] = {};
      winterSeasSp[wk][r.name] = true;
    }

    // v2: Breeding Witness
    if (r.breeding && r.name) breedingSp[r.name] = true;

    // v2: per-checklist fields
    if (r.subId) {
      if (subIdAllObs[r.subId] === undefined) subIdAllObs[r.subId] = true;
      if (!r.allObs) subIdAllObs[r.subId] = false;
      if (r.count === 'X' || r.count === 'x') subIdHasX[r.subId] = true;
      if (r.duration && !subIdDuration[r.subId]) subIdDuration[r.subId] = r.duration;
      if (r.distance && !subIdDistance[r.subId]) subIdDistance[r.subId] = r.distance;
      if (r.protocol && !subIdProtocol[r.subId]) subIdProtocol[r.subId] = r.protocol;
    }

    // v2: Species Comments
    if (r.speciesComments) speciesCommentRows++;
    if ((r.count === '0' || r.count === 0) && r.name) heardOnlySpecies[r.name] = true;

    // v2: PNW pack — Dipper's Creed
    if (r.name === 'American Dipper' && r.subId) dippersCreedSubs[r.subId] = true;

    // v2: PNW pack — Malheur Pilgrimage
    if (r.subId && r.state === 'US-OR' && r.county === 'Harney' &&
        r.location && r.location.toLowerCase().indexOf('malheur') !== -1) {
      malheurSubs[r.subId] = true;
    }
  });

  // ── Post-forEach: existing ──
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

  // ── Post-forEach: v2 ──

  // Max checklists at single location
  var maxPatchChk = 0;
  Object.keys(locationSubIds).forEach(function(loc) {
    var n = Object.keys(locationSubIds[loc]).length;
    if (n > maxPatchChk) maxPatchChk = n;
  });

  // Loyalist: species appearing on the most checklists
  var loyCount = 0, loyName = '';
  Object.keys(speciesSubIds).forEach(function(name) {
    var n = Object.keys(speciesSubIds[name]).length;
    if (n > loyCount) { loyCount = n; loyName = name; }
  });

  // Phenologist: best single-location month coverage
  var bestLocMonths = 0, locsWithAll12 = 0;
  Object.keys(locationMonths).forEach(function(loc) {
    var n = Object.keys(locationMonths[loc]).length;
    if (n > bestLocMonths) bestLocMonths = n;
    if (n >= 12) locsWithAll12++;
  });

  // New Year's Devotee: longest streak of consecutive Jan 1 years
  var janYears = Object.keys(janFirstYears).map(Number).sort();
  var maxJanStreak = 0, curJanStreak = 0, prevJanYear = -99;
  janYears.forEach(function(y) {
    curJanStreak = (y === prevJanYear + 1) ? curJanStreak + 1 : 1;
    if (curJanStreak > maxJanStreak) maxJanStreak = curJanStreak;
    prevJanYear = y;
  });

  // Migration max
  var maxMigSp = 0;
  Object.keys(migYearSp).forEach(function(y) {
    var n = Object.keys(migYearSp[y]).length;
    if (n > maxMigSp) maxMigSp = n;
  });

  // Winter max
  var maxWinterSp = 0;
  Object.keys(winterSeasSp).forEach(function(wk) {
    var n = Object.keys(winterSeasSp[wk]).length;
    if (n > maxWinterSp) maxWinterSp = n;
  });

  // Big Sit (stationary duration) + Death March (traveling distance)
  var maxStatDur = 0, maxTravDist = 0;
  Object.keys(subIdDuration).forEach(function(sid) {
    var proto = (subIdProtocol[sid] || '').toLowerCase();
    var dur   = subIdDuration[sid] || 0;
    if (proto.indexOf('stationary') !== -1 && dur > maxStatDur) maxStatDur = dur;
  });
  Object.keys(subIdDistance).forEach(function(sid) {
    var proto = (subIdProtocol[sid] || '').toLowerCase();
    var dist  = subIdDistance[sid] || 0;
    if (proto.indexOf('traveling') !== -1 && dist > maxTravDist) maxTravDist = dist;
  });

  // Completionist
  var completeChks = 0, totalWithAllObs = Object.keys(subIdAllObs).length;
  Object.keys(subIdAllObs).forEach(function(sid) { if (subIdAllObs[sid]) completeChks++; });

  // All-numeric checklists (no 'X' count)
  var totalChkCount = Object.keys(checklistIds).length;
  var numericChks = totalChkCount - Object.keys(subIdHasX).length;

  var countiesOver100sp = 0;
  Object.keys(countySpeciesMap).forEach(function(ck) {
    if (Object.keys(countySpeciesMap[ck]).length >= 100) countiesOver100sp++;
  });

  return {
    _speciesSeen:        speciesSeen,
    totalSpecies:        Object.keys(speciesSeen).length,
    totalChecklists:     totalChkCount,
    bestYearCount:       bestYearCount,
    bestYearLabel:       bestYearLabel,
    activeMonths:        Object.keys(monthsActive).length,
    seasonsWithBirding:  Object.keys(seasonsActive).length,
    yearsWithAllMonths:  yearsAllMonths,
    preSixChecklists:    Object.keys(preSixSubs).length,
    preEightChecklists:  Object.keys(preEightSubs).length,
    stateCount:          Object.keys(states).length,
    countyCount:         Object.keys(counties).length,
    countryCount:        Object.keys(countries).length,
    maxSpeciesInDay:     maxDay,
    pnwCounties:         Object.keys(pnwCounties).length,
    caCounties:          Object.keys(caCounties).length,
    desertCounties:      Object.keys(desertCounties).length,
    txCounties:          Object.keys(txCounties).length,
    flCounties:          Object.keys(flCounties).length,
    rockiesCounties:     Object.keys(rockiesCounties).length,
    // v2
    midnightChecklists:  Object.keys(midnightSubs).length,
    maxMigrationSp:      maxMigSp,
    maxWinterSp:         maxWinterSp,
    breedingSpCount:     Object.keys(breedingSp).length,
    maxPatchChecklists:  maxPatchChk,
    loyalistCount:       loyCount,
    loyalistSpecies:     loyName,
    bestLocationMonths:  bestLocMonths,
    locsWithAllMonths:   locsWithAll12,
    newYearStreak:       maxJanStreak,
    hasLeapLister:       hasLeap,
    speciesCommentRows:  speciesCommentRows,
    allNumericChklists:  numericChks,
    completeChklists:    completeChks,
    totalWithAllObs:     totalWithAllObs,
    maxStatDuration:     maxStatDur,
    maxTravelDist:       maxTravDist,
    dippersCreedCount:      Object.keys(dippersCreedSubs).length,
    malheurCount:           Object.keys(malheurSubs).length,
    heardOnlySpeciesCount:  Object.keys(heardOnlySpecies).length,
    countiesOver100sp:      countiesOver100sp,
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

function _speciesFromList(speciesSeen, list) {
  var n = 0;
  list.forEach(function(name) { if (speciesSeen[name]) n++; });
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

  // ⏰  TEMPORAL — v2: Migration Rider (Apr–May)
  { id:'tmp_mig1', category:'temporal', tier:1, icon:'🦋',
    name:'First Wave',
    desc:'40 distinct species in your best April–May window. Migration has arrived.',
    compute:function(s){ return{earned:s.maxMigrationSp>=40,  progress:Math.min(s.maxMigrationSp,40),  total:40,  detail:'Best spring: '+s.maxMigrationSp+' sp'}; }},
  { id:'tmp_mig2', category:'temporal', tier:2, icon:'🦋',
    name:'Migration Rider',
    desc:'60 spring species in one year. You\'re out every weekend.',
    compute:function(s){ return{earned:s.maxMigrationSp>=60,  progress:Math.min(s.maxMigrationSp,60),  total:60,  detail:'Best spring: '+s.maxMigrationSp+' sp'}; }},
  { id:'tmp_mig3', category:'temporal', tier:3, icon:'🦋',
    name:'Full Flood',
    desc:'75 species during spring migration. The flyways are flowing.',
    compute:function(s){ return{earned:s.maxMigrationSp>=75,  progress:Math.min(s.maxMigrationSp,75),  total:75,  detail:'Best spring: '+s.maxMigrationSp+' sp'}; }},
  { id:'tmp_mig4', category:'temporal', tier:5, icon:'🦋',
    name:'Rides the River',
    desc:'125 species in Apr–May. You exist for these two months.',
    compute:function(s){ return{earned:s.maxMigrationSp>=125, progress:Math.min(s.maxMigrationSp,125), total:125, detail:'Best spring: '+s.maxMigrationSp+' sp'}; }},

  // ⏰  TEMPORAL — v2: Winter Holdout (Dec–Jan)
  { id:'tmp_win1', category:'temporal', tier:1, icon:'❄️',
    name:'Cold Enough',
    desc:'20 species in a single Dec–Jan winter. You don\'t stop for the cold.',
    compute:function(s){ return{earned:s.maxWinterSp>=20, progress:Math.min(s.maxWinterSp,20), total:20, detail:'Best winter: '+s.maxWinterSp+' sp'}; }},
  { id:'tmp_win2', category:'temporal', tier:2, icon:'❄️',
    name:'Winter Holdout',
    desc:'30 winter species (Dec–Jan). You have a thermos and a strategy.',
    compute:function(s){ return{earned:s.maxWinterSp>=30, progress:Math.min(s.maxWinterSp,30), total:30, detail:'Best winter: '+s.maxWinterSp+' sp'}; }},
  { id:'tmp_win3', category:'temporal', tier:3, icon:'❄️',
    name:'Frozen But Here',
    desc:'40 winter species in a single season.',
    compute:function(s){ return{earned:s.maxWinterSp>=40, progress:Math.min(s.maxWinterSp,40), total:40, detail:'Best winter: '+s.maxWinterSp+' sp'}; }},
  { id:'tmp_win4', category:'temporal', tier:5, icon:'❄️',
    name:'Winter Devotee',
    desc:'75 species Dec–Jan. You know where the owls roost and the irruptions go.',
    compute:function(s){ return{earned:s.maxWinterSp>=75, progress:Math.min(s.maxWinterSp,75), total:75, detail:'Best winter: '+s.maxWinterSp+' sp'}; }},

  // ⏰  TEMPORAL — v2: Midnight Communion (00:00–02:59)
  { id:'tmp_mid1', category:'temporal', tier:1, icon:'🌙',
    name:'Something Moves at Night',
    desc:'First checklist started between midnight and 3 AM.',
    compute:function(s){ return{earned:s.midnightChecklists>=1,  progress:Math.min(s.midnightChecklists,1),  total:1};  }},
  { id:'tmp_mid2', category:'temporal', tier:2, icon:'🌙',
    name:'Midnight Communion',
    desc:'5 midnight-hour checklists. You\'ve committed.',
    compute:function(s){ return{earned:s.midnightChecklists>=5,  progress:Math.min(s.midnightChecklists,5),  total:5};  }},
  { id:'tmp_mid3', category:'temporal', tier:3, icon:'🌙',
    name:'Owns the Dark',
    desc:'15 checklists in the witching hours.',
    compute:function(s){ return{earned:s.midnightChecklists>=15, progress:Math.min(s.midnightChecklists,15), total:15}; }},
  { id:'tmp_mid4', category:'temporal', tier:5, icon:'🌙',
    name:'No Such Thing as Bedtime',
    desc:'50 midnight-to-3-AM checklists. You\'ve made peace with this.',
    compute:function(s){ return{earned:s.midnightChecklists>=50, progress:Math.min(s.midnightChecklists,50), total:50}; }},

  // ══════════════════════════════════════════════════════════
  // 🔬  SPECIES EXPLORER
  // ══════════════════════════════════════════════════════════

  // — Owls —
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

  // — Raptors —
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

  // — Waterfowl —
  { id:'sp_wf1', category:'species', tier:1, icon:'🦆', name:'Pond Visitor',
    desc:'Your first duck, goose, or swan.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['duck','teal','goose','geese','swan','merganser','scoter','scaup','bufflehead','goldeneye','pintail','wigeon','shoveler','canvasback','redhead','mallard','gadwall','eider']); return{earned:n>=1, progress:Math.min(n,1),  total:1};  }},
  { id:'sp_wf2', category:'species', tier:2, icon:'🦆', name:'Duck Season',
    desc:'10 waterfowl species.',
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

  // — Warblers —
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

  // — Shorebirds —
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

  // — Sparrows —
  { id:'sp_sp1', category:'species', tier:1, icon:'🐦', name:'LBJ Spotter',
    desc:'3 sparrow species. LBJ: Little Brown Job.',
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

  // — Hummingbirds —
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

  // — Woodpeckers —
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

  // — Gulls —
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

  // — Flycatchers —
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

  // — Herons & Egrets —
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

  // — v2: Breeding Witness —
  { id:'sp_bw1', category:'species', tier:1, icon:'🐣', name:'Noted Behavior',
    desc:'Record a confirmed breeding code for 3 species. Something is nesting.',
    compute:function(s){ return{earned:s.breedingSpCount>=3,  progress:Math.min(s.breedingSpCount,3),  total:3};  }},
  { id:'sp_bw2', category:'species', tier:2, icon:'🐣', name:'Breeding Witness',
    desc:'6 species with confirmed breeding codes.',
    compute:function(s){ return{earned:s.breedingSpCount>=6,  progress:Math.min(s.breedingSpCount,6),  total:6};  }},
  { id:'sp_bw3', category:'species', tier:3, icon:'🐣', name:'Season Keeper',
    desc:'10 confirmed breeding species. You\'re watching the whole cycle.',
    compute:function(s){ return{earned:s.breedingSpCount>=10, progress:Math.min(s.breedingSpCount,10), total:10}; }},
  { id:'sp_bw4', category:'species', tier:5, icon:'🐣', name:'Nest Finder',
    desc:'25 confirmed breeding species across your history.',
    compute:function(s){ return{earned:s.breedingSpCount>=25, progress:Math.min(s.breedingSpCount,25), total:25}; }},

  // — v2: The Marsh Phantom (Rallidae) —
  { id:'sp_ra1', category:'species', tier:1, icon:'🪶', name:'Heard in the Reeds',
    desc:'3 rail, coot, or gallinule species. They were calling. You were listening.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['rail','coot','gallinule','moorhen','sora','limpkin']); return{earned:n>=3, progress:Math.min(n,3),  total:3};  }},
  { id:'sp_ra2', category:'species', tier:2, icon:'🪶', name:'The Marsh Phantom',
    desc:'5 rallid species. You know the marshes.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['rail','coot','gallinule','moorhen','sora','limpkin']); return{earned:n>=5, progress:Math.min(n,5),  total:5};  }},
  { id:'sp_ra3', category:'species', tier:3, icon:'🪶', name:'Fen Walker',
    desc:'8 rallid species. You wade for these.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['rail','coot','gallinule','moorhen','sora','limpkin']); return{earned:n>=8, progress:Math.min(n,8),  total:8};  }},
  { id:'sp_ra4', category:'species', tier:5, icon:'🪶', name:'All the Rails',
    desc:'12 rallid species. You\'ve found them in every marsh.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['rail','coot','gallinule','moorhen','sora','limpkin']); return{earned:n>=12,progress:Math.min(n,12), total:12}; }},

  // — v2: The Silent Witness (Troglodytidae — wrens) —
  { id:'sp_wr1', category:'species', tier:1, icon:'🎵', name:'That Little Brown Voice',
    desc:'4 wren species. Loud for their size.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['wren']); return{earned:n>=4, progress:Math.min(n,4),  total:4};  }},
  { id:'sp_wr2', category:'species', tier:2, icon:'🎵', name:'The Silent Witness',
    desc:'7 wren species. You\'ve been in the right thickets.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['wren']); return{earned:n>=7, progress:Math.min(n,7),  total:7};  }},
  { id:'sp_wr3', category:'species', tier:3, icon:'🎵', name:'Thicket Oracle',
    desc:'10 wren species.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['wren']); return{earned:n>=10,progress:Math.min(n,10), total:10}; }},
  { id:'sp_wr4', category:'species', tier:5, icon:'🎵', name:'Heard Every Wren',
    desc:'15 wren species. A lifetime of listening in brushy places.',
    compute:function(s){ var n=_nameMatch(s._speciesSeen,['wren']); return{earned:n>=15,progress:Math.min(n,15), total:15}; }},

  // ══════════════════════════════════════════════════════════
  // 🌎  REGIONAL — depth within specific geographic regions
  // ══════════════════════════════════════════════════════════

  // — Pacific Northwest —
  { id:'reg_pnw1', category:'regional', tier:1, icon:'🌲', name:'Smells Like Rain',
    desc:'2 PNW counties (Oregon or Washington).',
    compute:function(s){ return{earned:s.pnwCounties>=2,  progress:Math.min(s.pnwCounties,2),  total:2};  }},
  { id:'reg_pnw2', category:'regional', tier:2, icon:'🌲', name:'Cascade Crosser',
    desc:'8 PNW counties — you\'ve birded both sides of the mountains.',
    compute:function(s){ return{earned:s.pnwCounties>=8,  progress:Math.min(s.pnwCounties,8),  total:8};  }},
  { id:'reg_pnw3', category:'regional', tier:3, icon:'🌲', name:'Knows the Peninsula',
    desc:'20 PNW counties.',
    compute:function(s){ return{earned:s.pnwCounties>=20, progress:Math.min(s.pnwCounties,20), total:20}; }},
  { id:'reg_pnw4', category:'regional', tier:4, icon:'🌲', name:'Oregon Trailed',
    desc:'40 PNW counties.',
    compute:function(s){ return{earned:s.pnwCounties>=40, progress:Math.min(s.pnwCounties,40), total:40}; }},
  { id:'reg_pnw5', category:'regional', tier:5, icon:'🌲', name:'Moss-Covered Lister',
    desc:'65 of 75 PNW counties. You are the PNW.',
    compute:function(s){ return{earned:s.pnwCounties>=65, progress:Math.min(s.pnwCounties,65), total:65}; }},

  // — California —
  { id:'reg_ca1', category:'regional', tier:1, icon:'☀️', name:'California Dreamin\'',
    desc:'2 California counties.',
    compute:function(s){ return{earned:s.caCounties>=2,  progress:Math.min(s.caCounties,2),  total:2};  }},
  { id:'reg_ca2', category:'regional', tier:2, icon:'☀️', name:'Beyond the Bay',
    desc:'8 CA counties — you left the coast bubble.',
    compute:function(s){ return{earned:s.caCounties>=8,  progress:Math.min(s.caCounties,8),  total:8};  }},
  { id:'reg_ca3', category:'regional', tier:3, icon:'☀️', name:'Central Valley Run',
    desc:'20 CA counties.',
    compute:function(s){ return{earned:s.caCounties>=20, progress:Math.min(s.caCounties,20), total:20}; }},
  { id:'reg_ca4', category:'regional', tier:4, icon:'☀️', name:'Knows the Coast Highway',
    desc:'40 CA counties.',
    compute:function(s){ return{earned:s.caCounties>=40, progress:Math.min(s.caCounties,40), total:40}; }},
  { id:'reg_ca5', category:'regional', tier:5, icon:'☀️', name:'All 58',
    desc:'55 of California\'s 58 counties.',
    compute:function(s){ return{earned:s.caCounties>=55, progress:Math.min(s.caCounties,55), total:55}; }},

  // — Desert Southwest —
  { id:'reg_ds1', category:'regional', tier:1, icon:'🏜️', name:'Heard a Cactus Wren',
    desc:'1 desert county. Welcome to the Sonoran.',
    compute:function(s){ return{earned:s.desertCounties>=1,  progress:Math.min(s.desertCounties,1),  total:1};  }},
  { id:'reg_ds2', category:'regional', tier:2, icon:'🏜️', name:'Roadrunner Country',
    desc:'5 desert counties.',
    compute:function(s){ return{earned:s.desertCounties>=5,  progress:Math.min(s.desertCounties,5),  total:5};  }},
  { id:'reg_ds3', category:'regional', tier:3, icon:'🏜️', name:'Knows the Washes',
    desc:'15 desert counties.',
    compute:function(s){ return{earned:s.desertCounties>=15, progress:Math.min(s.desertCounties,15), total:15}; }},
  { id:'reg_ds4', category:'regional', tier:4, icon:'🏜️', name:'Painted Desert Regular',
    desc:'35 desert counties.',
    compute:function(s){ return{earned:s.desertCounties>=35, progress:Math.min(s.desertCounties,35), total:35}; }},
  { id:'reg_ds5', category:'regional', tier:5, icon:'🏜️', name:'Desert Soul',
    desc:'65 desert counties across AZ, NV, UT, and NM.',
    compute:function(s){ return{earned:s.desertCounties>=65, progress:Math.min(s.desertCounties,65), total:65}; }},

  // — Texas —
  { id:'reg_tx1', category:'regional', tier:1, icon:'🤠', name:'Heard a Mockingbird',
    desc:'2 Texas counties.',
    compute:function(s){ return{earned:s.txCounties>=2,   progress:Math.min(s.txCounties,2),   total:2};   }},
  { id:'reg_tx2', category:'regional', tier:2, icon:'🤠', name:'Coast to Hill Country',
    desc:'10 TX counties.',
    compute:function(s){ return{earned:s.txCounties>=10,  progress:Math.min(s.txCounties,10),  total:10};  }},
  { id:'reg_tx3', category:'regional', tier:3, icon:'🤠', name:'Trans-Pecos Dreamer',
    desc:'30 TX counties.',
    compute:function(s){ return{earned:s.txCounties>=30,  progress:Math.min(s.txCounties,30),  total:30};  }},
  { id:'reg_tx4', category:'regional', tier:4, icon:'🤠', name:'Big Bend Regular',
    desc:'75 TX counties.',
    compute:function(s){ return{earned:s.txCounties>=75,  progress:Math.min(s.txCounties,75),  total:75};  }},
  { id:'reg_tx5', category:'regional', tier:5, icon:'🤠', name:'Deep in the Heart',
    desc:'150 Texas counties. It\'s big. You know.',
    compute:function(s){ return{earned:s.txCounties>=150, progress:Math.min(s.txCounties,150), total:150}; }},

  // — Florida —
  { id:'reg_fl1', category:'regional', tier:1, icon:'🦩', name:'Florida Man, Birder Edition',
    desc:'2 Florida counties.',
    compute:function(s){ return{earned:s.flCounties>=2,  progress:Math.min(s.flCounties,2),  total:2};  }},
  { id:'reg_fl2', category:'regional', tier:2, icon:'🦩', name:'Saw a Spoonbill',
    desc:'8 FL counties.',
    compute:function(s){ return{earned:s.flCounties>=8,  progress:Math.min(s.flCounties,8),  total:8};  }},
  { id:'reg_fl3', category:'regional', tier:3, icon:'🦩', name:'Both Coasts',
    desc:'20 FL counties.',
    compute:function(s){ return{earned:s.flCounties>=20, progress:Math.min(s.flCounties,20), total:20}; }},
  { id:'reg_fl4', category:'regional', tier:4, icon:'🦩', name:'Knows the Keys',
    desc:'40 FL counties.',
    compute:function(s){ return{earned:s.flCounties>=40, progress:Math.min(s.flCounties,40), total:40}; }},
  { id:'reg_fl5', category:'regional', tier:5, icon:'🦩', name:'All 67',
    desc:'60 of Florida\'s 67 counties.',
    compute:function(s){ return{earned:s.flCounties>=60, progress:Math.min(s.flCounties,60), total:60}; }},

  // — Rocky Mountains —
  { id:'reg_rm1', category:'regional', tier:1, icon:'⛰️', name:'Above Treeline',
    desc:'2 Rockies counties.',
    compute:function(s){ return{earned:s.rockiesCounties>=2,   progress:Math.min(s.rockiesCounties,2),   total:2};   }},
  { id:'reg_rm2', category:'regional', tier:2, icon:'⛰️', name:'Mountain Birder',
    desc:'10 Rockies counties.',
    compute:function(s){ return{earned:s.rockiesCounties>=10,  progress:Math.min(s.rockiesCounties,10),  total:10};  }},
  { id:'reg_rm3', category:'regional', tier:3, icon:'⛰️', name:'High Country Regular',
    desc:'30 Rockies counties.',
    compute:function(s){ return{earned:s.rockiesCounties>=30,  progress:Math.min(s.rockiesCounties,30),  total:30};  }},
  { id:'reg_rm4', category:'regional', tier:4, icon:'⛰️', name:'Summit Lister',
    desc:'70 Rockies counties.',
    compute:function(s){ return{earned:s.rockiesCounties>=70,  progress:Math.min(s.rockiesCounties,70),  total:70};  }},
  { id:'reg_rm5', category:'regional', tier:5, icon:'⛰️', name:'The Rockies Run',
    desc:'140 Rockies counties across CO, ID, MT, and WY.',
    compute:function(s){ return{earned:s.rockiesCounties>=140, progress:Math.min(s.rockiesCounties,140), total:140}; }},

  // ══════════════════════════════════════════════════════════
  // 🌱  ON-RAMP
  // ══════════════════════════════════════════════════════════

  { id:'on_comp', category:'onramp', tier:2, icon:'✅',
    name:'The Completionist',
    desc:'90%+ of your checklists marked "All Observations Reported" (min 20 checklists). Rewards good eBird hygiene.',
    compute:function(s){
      if (s.totalWithAllObs < 20) return{earned:false, progress:s.totalWithAllObs, total:20, detail:'Need 20+ checklists'};
      var pct = Math.round(s.completeChklists / s.totalWithAllObs * 100);
      return{earned:pct>=90, progress:Math.min(pct,90), total:90, detail:pct+'% complete checklists'};
    }},

  { id:'on_scr1', category:'onramp', tier:1, icon:'✏️',
    name:'Field Notes',
    desc:'10 observations with species comments. You\'re writing things down.',
    compute:function(s){ return{earned:s.speciesCommentRows>=10,   progress:Math.min(s.speciesCommentRows,10),   total:10};   }},
  { id:'on_scr2', category:'onramp', tier:2, icon:'✏️',
    name:'The Scribe',
    desc:'50 annotated observations. Details matter.',
    compute:function(s){ return{earned:s.speciesCommentRows>=50,   progress:Math.min(s.speciesCommentRows,50),   total:50};   }},
  { id:'on_scr3', category:'onramp', tier:3, icon:'✏️',
    name:'Field Journal',
    desc:'200 observations with species comments.',
    compute:function(s){ return{earned:s.speciesCommentRows>=200,  progress:Math.min(s.speciesCommentRows,200),  total:200};  }},
  { id:'on_scr4', category:'onramp', tier:5, icon:'✏️',
    name:'Annotator',
    desc:'1,000 species comments. A naturalist\'s record, not just a list.',
    compute:function(s){ return{earned:s.speciesCommentRows>=1000, progress:Math.min(s.speciesCommentRows,1000), total:1000}; }},

  { id:'on_en1', category:'onramp', tier:1, icon:'🔢',
    name:'Actually Counting',
    desc:'25 checklists where every count is a number — no "X" estimates.',
    compute:function(s){ return{earned:s.allNumericChklists>=25,   progress:Math.min(s.allNumericChklists,25),   total:25};   }},
  { id:'on_en2', category:'onramp', tier:2, icon:'🔢',
    name:'The Enumerator',
    desc:'100 checklists with precise counts only.',
    compute:function(s){ return{earned:s.allNumericChklists>=100,  progress:Math.min(s.allNumericChklists,100),  total:100};  }},
  { id:'on_en3', category:'onramp', tier:3, icon:'🔢',
    name:'Count of It All',
    desc:'500 checklists without a single "X" entry.',
    compute:function(s){ return{earned:s.allNumericChklists>=500,  progress:Math.min(s.allNumericChklists,500),  total:500};  }},
  { id:'on_en4', category:'onramp', tier:5, icon:'🔢',
    name:'Nothing Was Estimated',
    desc:'2,000 fully enumerated checklists.',
    compute:function(s){ return{earned:s.allNumericChklists>=2000, progress:Math.min(s.allNumericChklists,2000), total:2000}; }},

  // ══════════════════════════════════════════════════════════
  // 🎲  QUIRK
  // ══════════════════════════════════════════════════════════

  // The Big Sit — max single stationary count duration
  { id:'qk_sit1', category:'quirk', tier:1, icon:'🪑',
    name:'Sitting Still',
    desc:'A stationary count lasting at least 3 hours. Patience is underrated.',
    compute:function(s){ return{earned:s.maxStatDuration>=180, progress:Math.min(s.maxStatDuration,180), total:180, detail:'Best: '+Math.round(s.maxStatDuration)+' min'}; }},
  { id:'qk_sit2', category:'quirk', tier:2, icon:'🪑',
    name:'The Big Sit',
    desc:'5 hours stationary. You brought snacks.',
    compute:function(s){ return{earned:s.maxStatDuration>=300, progress:Math.min(s.maxStatDuration,300), total:300, detail:'Best: '+Math.round(s.maxStatDuration)+' min'}; }},
  { id:'qk_sit3', category:'quirk', tier:3, icon:'🪑',
    name:'Root System',
    desc:'8-hour stationary count. The birds know your spot.',
    compute:function(s){ return{earned:s.maxStatDuration>=480, progress:Math.min(s.maxStatDuration,480), total:480, detail:'Best: '+Math.round(s.maxStatDuration)+' min'}; }},
  { id:'qk_sit4', category:'quirk', tier:5, icon:'🪑',
    name:'Could Not Be Moved',
    desc:'12 hours stationary. Dawn to dusk, one point on the map.',
    compute:function(s){ return{earned:s.maxStatDuration>=720, progress:Math.min(s.maxStatDuration,720), total:720, detail:'Best: '+Math.round(s.maxStatDuration)+' min'}; }},

  // The Death March — max single traveling distance
  { id:'qk_dm1', category:'quirk', tier:1, icon:'🥾',
    name:'Walked a While',
    desc:'A single traveling count covering 8+ km. You kept going.',
    compute:function(s){ return{earned:s.maxTravelDist>=8,  progress:Math.min(s.maxTravelDist,8),  total:8,  detail:'Best: '+s.maxTravelDist.toFixed(1)+' km'}; }},
  { id:'qk_dm2', category:'quirk', tier:2, icon:'🥾',
    name:'The Death March',
    desc:'15 km in a single traveling count.',
    compute:function(s){ return{earned:s.maxTravelDist>=15, progress:Math.min(s.maxTravelDist,15), total:15, detail:'Best: '+s.maxTravelDist.toFixed(1)+' km'}; }},
  { id:'qk_dm3', category:'quirk', tier:3, icon:'🥾',
    name:'Serious Mileage',
    desc:'25 km in a single count. That\'s a long walk with binoculars.',
    compute:function(s){ return{earned:s.maxTravelDist>=25, progress:Math.min(s.maxTravelDist,25), total:25, detail:'Best: '+s.maxTravelDist.toFixed(1)+' km'}; }},
  { id:'qk_dm4', category:'quirk', tier:5, icon:'🥾',
    name:'Suffered for the List',
    desc:'40 km in one traveling count. You will feel it tomorrow.',
    compute:function(s){ return{earned:s.maxTravelDist>=40, progress:Math.min(s.maxTravelDist,40), total:40, detail:'Best: '+s.maxTravelDist.toFixed(1)+' km'}; }},

  // The Phenologist — same location across calendar months
  { id:'qk_phen1', category:'quirk', tier:1, icon:'🗓️',
    name:'Seasonal Regular',
    desc:'One location visited across 8 different calendar months.',
    compute:function(s){ return{earned:s.bestLocationMonths>=8,  progress:Math.min(s.bestLocationMonths,8),  total:8,  detail:'Best patch: '+s.bestLocationMonths+' months'}; }},
  { id:'qk_phen2', category:'quirk', tier:2, icon:'🗓️',
    name:'The Phenologist',
    desc:'10 months at one location. You\'re tracking the seasons.',
    compute:function(s){ return{earned:s.bestLocationMonths>=10, progress:Math.min(s.bestLocationMonths,10), total:10, detail:'Best patch: '+s.bestLocationMonths+' months'}; }},
  { id:'qk_phen3', category:'quirk', tier:3, icon:'🗓️',
    name:'All Twelve at One Patch',
    desc:'Every calendar month visited at a single location.',
    compute:function(s){ return{earned:s.bestLocationMonths>=12, progress:Math.min(s.bestLocationMonths,12), total:12, detail:'Best patch: '+s.bestLocationMonths+' months'}; }},
  { id:'qk_phen4', category:'quirk', tier:5, icon:'🗓️',
    name:'Three Patches, All Year',
    desc:'All 12 months covered at 3 or more different locations.',
    compute:function(s){ return{earned:s.locsWithAllMonths>=3, progress:Math.min(s.locsWithAllMonths,3), total:3, detail:s.locsWithAllMonths+' location(s) with all 12 months'}; }},

  // New Year's Devotee — consecutive Jan 1 checklist years
  { id:'qk_ny1', category:'quirk', tier:1, icon:'🎆',
    name:'New Year, Same Bird',
    desc:'A Jan 1 checklist in 2 consecutive years.',
    compute:function(s){ return{earned:s.newYearStreak>=2,  progress:Math.min(s.newYearStreak,2),  total:2,  detail:'Streak: '+s.newYearStreak+' yr'}; }},
  { id:'qk_ny2', category:'quirk', tier:2, icon:'🎆',
    name:'New Year\'s Devotee',
    desc:'Jan 1 checklist in 3 straight years.',
    compute:function(s){ return{earned:s.newYearStreak>=3,  progress:Math.min(s.newYearStreak,3),  total:3,  detail:'Streak: '+s.newYearStreak+' yr'}; }},
  { id:'qk_ny3', category:'quirk', tier:3, icon:'🎆',
    name:'Rite of January',
    desc:'5 consecutive Jan 1 checklists.',
    compute:function(s){ return{earned:s.newYearStreak>=5,  progress:Math.min(s.newYearStreak,5),  total:5,  detail:'Streak: '+s.newYearStreak+' yr'}; }},
  { id:'qk_ny4', category:'quirk', tier:5, icon:'🎆',
    name:'Every First of the Year',
    desc:'Jan 1 checklist for 10 straight years. It\'s a ritual now.',
    compute:function(s){ return{earned:s.newYearStreak>=10, progress:Math.min(s.newYearStreak,10), total:10, detail:'Streak: '+s.newYearStreak+' yr'}; }},

  // The Leap Lister — any Feb 29 checklist
  { id:'qk_leap', category:'quirk', tier:3, icon:'🐸',
    name:'The Leap Lister',
    desc:'A checklist on February 29th. This one only comes around every four years.',
    compute:function(s){ return{earned:s.hasLeapLister, progress:s.hasLeapLister?1:0, total:1}; }},

  // The Loyalist — one species on the most checklists
  { id:'qk_loy1', category:'quirk', tier:1, icon:'💚',
    name:'Your Bird',
    desc:'One species appears on 50 of your checklists. It knows your route.',
    compute:function(s){ var d=s.loyalistSpecies?' — '+s.loyalistSpecies:''; return{earned:s.loyalistCount>=50,  progress:Math.min(s.loyalistCount,50),  total:50,  detail:s.loyalistCount+' checklists'+d}; }},
  { id:'qk_loy2', category:'quirk', tier:2, icon:'💚',
    name:'The Loyalist',
    desc:'One species on 100 of your checklists.',
    compute:function(s){ var d=s.loyalistSpecies?' — '+s.loyalistSpecies:''; return{earned:s.loyalistCount>=100, progress:Math.min(s.loyalistCount,100), total:100, detail:s.loyalistCount+' checklists'+d}; }},
  { id:'qk_loy3', category:'quirk', tier:3, icon:'💚',
    name:'Constant Companion',
    desc:'One species on 200 of your checklists.',
    compute:function(s){ var d=s.loyalistSpecies?' — '+s.loyalistSpecies:''; return{earned:s.loyalistCount>=200, progress:Math.min(s.loyalistCount,200), total:200, detail:s.loyalistCount+' checklists'+d}; }},
  { id:'qk_loy4', category:'quirk', tier:5, icon:'💚',
    name:'Inseparable',
    desc:'One species follows you on 500 checklists. Or you follow it.',
    compute:function(s){ var d=s.loyalistSpecies?' — '+s.loyalistSpecies:''; return{earned:s.loyalistCount>=500, progress:Math.min(s.loyalistCount,500), total:500, detail:s.loyalistCount+' checklists'+d}; }},

  // Location Loyalty Ladder (The Patchling → The Rooted)
  { id:'qk_patch1', category:'quirk', tier:1, icon:'📍',
    name:'The Patchling',
    desc:'10 checklists at a single location. You have a patch.',
    compute:function(s){ return{earned:s.maxPatchChecklists>=10,  progress:Math.min(s.maxPatchChecklists,10),  total:10};  }},
  { id:'qk_patch2', category:'quirk', tier:2, icon:'📍',
    name:'Neighborhood Naturalist',
    desc:'25 checklists at one location. You know every corner of it.',
    compute:function(s){ return{earned:s.maxPatchChecklists>=25,  progress:Math.min(s.maxPatchChecklists,25),  total:25};  }},
  { id:'qk_patch3', category:'quirk', tier:3, icon:'📍',
    name:'Patch Warden',
    desc:'100 checklists at a single location. You are its unofficial guardian.',
    compute:function(s){ return{earned:s.maxPatchChecklists>=100, progress:Math.min(s.maxPatchChecklists,100), total:100}; }},
  { id:'qk_patch4', category:'quirk', tier:5, icon:'📍',
    name:'The Rooted',
    desc:'365 checklists at one location — an entire year\'s worth of visits.',
    compute:function(s){ return{earned:s.maxPatchChecklists>=365, progress:Math.min(s.maxPatchChecklists,365), total:365}; }},

  // ══════════════════════════════════════════════════════════
  // 🌲  PNW PACK
  // ══════════════════════════════════════════════════════════

  // The Dipper's Creed
  { id:'pnw_dip1', category:'pnw_pack', tier:1, icon:'💧',
    name:'Knelt at the Riffle',
    desc:'3 checklists including American Dipper. Cold water, fast current, one small miracle.',
    compute:function(s){ return{earned:s.dippersCreedCount>=3,  progress:Math.min(s.dippersCreedCount,3),  total:3};  }},
  { id:'pnw_dip2', category:'pnw_pack', tier:2, icon:'💧',
    name:'The Dipper\'s Creed',
    desc:'10 American Dipper checklists. You seek out the clear, cold streams.',
    compute:function(s){ return{earned:s.dippersCreedCount>=10, progress:Math.min(s.dippersCreedCount,10), total:10}; }},
  { id:'pnw_dip3', category:'pnw_pack', tier:3, icon:'💧',
    name:'Stream Devotee',
    desc:'25 checklists with the Dipper.',
    compute:function(s){ return{earned:s.dippersCreedCount>=25, progress:Math.min(s.dippersCreedCount,25), total:25}; }},
  { id:'pnw_dip4', category:'pnw_pack', tier:5, icon:'💧',
    name:'River Prayer',
    desc:'75 American Dipper checklists. You and the river have an understanding.',
    compute:function(s){ return{earned:s.dippersCreedCount>=75, progress:Math.min(s.dippersCreedCount,75), total:75}; }},

  // The Salmonberry Circuit
  { id:'pnw_sal1', category:'pnw_pack', tier:1, icon:'🌿',
    name:'Wet Side Birder',
    desc:'4 of 12 west-of-the-Cascades species. Fog, moss, and birds that would rather you didn\'t see them.',
    compute:function(s){
      var list=['Varied Thrush','Sooty Grouse','Harlequin Duck','Black Oystercatcher','Pacific Wren','Marbled Murrelet','Chestnut-backed Chickadee','Red-breasted Sapsucker','Band-tailed Pigeon','Northern Pygmy-Owl','Hermit Warbler','American Dipper'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=4, progress:Math.min(n,4), total:4, detail:n+'/12 wet-side spp'};
    }},
  { id:'pnw_sal2', category:'pnw_pack', tier:2, icon:'🌿',
    name:'The Salmonberry Circuit',
    desc:'7 of 12 wet-side PNW species.',
    compute:function(s){
      var list=['Varied Thrush','Sooty Grouse','Harlequin Duck','Black Oystercatcher','Pacific Wren','Marbled Murrelet','Chestnut-backed Chickadee','Red-breasted Sapsucker','Band-tailed Pigeon','Northern Pygmy-Owl','Hermit Warbler','American Dipper'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=7, progress:Math.min(n,7), total:7, detail:n+'/12 wet-side spp'};
    }},
  { id:'pnw_sal3', category:'pnw_pack', tier:3, icon:'🌿',
    name:'Deep Into the Fog',
    desc:'10 of 12 wet-side PNW species. You\'ve found the hard ones.',
    compute:function(s){
      var list=['Varied Thrush','Sooty Grouse','Harlequin Duck','Black Oystercatcher','Pacific Wren','Marbled Murrelet','Chestnut-backed Chickadee','Red-breasted Sapsucker','Band-tailed Pigeon','Northern Pygmy-Owl','Hermit Warbler','American Dipper'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=10, progress:Math.min(n,10), total:10, detail:n+'/12 wet-side spp'};
    }},
  { id:'pnw_sal4', category:'pnw_pack', tier:5, icon:'🌿',
    name:'Complete Circuit',
    desc:'All 12 wet-side PNW species. Every corner of the coast range.',
    compute:function(s){
      var list=['Varied Thrush','Sooty Grouse','Harlequin Duck','Black Oystercatcher','Pacific Wren','Marbled Murrelet','Chestnut-backed Chickadee','Red-breasted Sapsucker','Band-tailed Pigeon','Northern Pygmy-Owl','Hermit Warbler','American Dipper'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=12, progress:Math.min(n,12), total:12, detail:n+'/12 wet-side spp'};
    }},

  // The Sagebrush Sea
  { id:'pnw_sag1', category:'pnw_pack', tier:1, icon:'🌾',
    name:'Crossed the Mountains',
    desc:'3 of 10 east-side sagebrush species. Trade the ferns for silence and the smell of rain on sage.',
    compute:function(s){
      var list=['Greater Sage-Grouse','Sage Thrasher','Sagebrush Sparrow','Brewer\'s Sparrow','Burrowing Owl','Ferruginous Hawk','Long-billed Curlew','Loggerhead Shrike','Prairie Falcon','Rock Wren'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=3, progress:Math.min(n,3), total:3, detail:n+'/10 sagebrush spp'};
    }},
  { id:'pnw_sag2', category:'pnw_pack', tier:2, icon:'🌾',
    name:'The Sagebrush Sea',
    desc:'5 east-side sagebrush species.',
    compute:function(s){
      var list=['Greater Sage-Grouse','Sage Thrasher','Sagebrush Sparrow','Brewer\'s Sparrow','Burrowing Owl','Ferruginous Hawk','Long-billed Curlew','Loggerhead Shrike','Prairie Falcon','Rock Wren'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=5, progress:Math.min(n,5), total:5, detail:n+'/10 sagebrush spp'};
    }},
  { id:'pnw_sag3', category:'pnw_pack', tier:3, icon:'🌾',
    name:'Desert Fluency',
    desc:'8 sagebrush species. The high desert is speaking and you\'re listening.',
    compute:function(s){
      var list=['Greater Sage-Grouse','Sage Thrasher','Sagebrush Sparrow','Brewer\'s Sparrow','Burrowing Owl','Ferruginous Hawk','Long-billed Curlew','Loggerhead Shrike','Prairie Falcon','Rock Wren'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=8, progress:Math.min(n,8), total:8, detail:n+'/10 sagebrush spp'};
    }},
  { id:'pnw_sag4', category:'pnw_pack', tier:5, icon:'🌾',
    name:'All Ten Sages',
    desc:'All 10 sagebrush species. You earned the silence.',
    compute:function(s){
      var list=['Greater Sage-Grouse','Sage Thrasher','Sagebrush Sparrow','Brewer\'s Sparrow','Burrowing Owl','Ferruginous Hawk','Long-billed Curlew','Loggerhead Shrike','Prairie Falcon','Rock Wren'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=10, progress:Math.min(n,10), total:10, detail:n+'/10 sagebrush spp'};
    }},

  // The Alcid Ascetic
  { id:'pnw_alc1', category:'pnw_pack', tier:1, icon:'🌊',
    name:'Headland Watch',
    desc:'2 PNW alcid species. Stand on the headland and squint at the swells.',
    compute:function(s){
      var list=['Common Murre','Pigeon Guillemot','Marbled Murrelet','Ancient Murrelet','Cassin\'s Auklet','Rhinoceros Auklet','Tufted Puffin'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=2, progress:Math.min(n,2), total:2, detail:n+'/7 alcids'};
    }},
  { id:'pnw_alc2', category:'pnw_pack', tier:2, icon:'🌊',
    name:'The Alcid Ascetic',
    desc:'4 PNW alcid species. The sea gives up its monks reluctantly.',
    compute:function(s){
      var list=['Common Murre','Pigeon Guillemot','Marbled Murrelet','Ancient Murrelet','Cassin\'s Auklet','Rhinoceros Auklet','Tufted Puffin'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=4, progress:Math.min(n,4), total:4, detail:n+'/7 alcids'};
    }},
  { id:'pnw_alc3', category:'pnw_pack', tier:3, icon:'🌊',
    name:'Monk of the Sea',
    desc:'6 of 7 PNW alcids.',
    compute:function(s){
      var list=['Common Murre','Pigeon Guillemot','Marbled Murrelet','Ancient Murrelet','Cassin\'s Auklet','Rhinoceros Auklet','Tufted Puffin'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=6, progress:Math.min(n,6), total:6, detail:n+'/7 alcids'};
    }},
  { id:'pnw_alc4', category:'pnw_pack', tier:5, icon:'🌊',
    name:'Complete Order',
    desc:'All 7 PNW alcids. Every monk accounted for.',
    compute:function(s){
      var list=['Common Murre','Pigeon Guillemot','Marbled Murrelet','Ancient Murrelet','Cassin\'s Auklet','Rhinoceros Auklet','Tufted Puffin'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=7, progress:Math.min(n,7), total:7, detail:n+'/7 alcids'};
    }},

  // The Malheur Pilgrimage
  { id:'pnw_mal1', category:'pnw_pack', tier:1, icon:'🏕️',
    name:'Paid the Debt',
    desc:'First checklist at Malheur NWR (Harney Co., Oregon). Every PNW birder owes the high desert a spring.',
    compute:function(s){ return{earned:s.malheurCount>=1,  progress:Math.min(s.malheurCount,1),  total:1};  }},
  { id:'pnw_mal2', category:'pnw_pack', tier:2, icon:'🏕️',
    name:'The Malheur Pilgrim',
    desc:'5 checklists at Malheur NWR.',
    compute:function(s){ return{earned:s.malheurCount>=5,  progress:Math.min(s.malheurCount,5),  total:5};  }},
  { id:'pnw_mal3', category:'pnw_pack', tier:3, icon:'🏕️',
    name:'Return of the Pilgrim',
    desc:'15 Malheur checklists. You keep going back.',
    compute:function(s){ return{earned:s.malheurCount>=15, progress:Math.min(s.malheurCount,15), total:15}; }},
  { id:'pnw_mal4', category:'pnw_pack', tier:5, icon:'🏕️',
    name:'Lives at Malheur',
    desc:'50 checklists at the refuge. This is your spring ritual.',
    compute:function(s){ return{earned:s.malheurCount>=50, progress:Math.min(s.malheurCount,50), total:50}; }},

  // The Estuary Keeper
  { id:'pnw_est1', category:'pnw_pack', tier:1, icon:'🦀',
    name:'Mudflat Discovery',
    desc:'3 of 8 estuary species. Where the river forgets it was ever in a hurry.',
    compute:function(s){
      var list=['Black-bellied Plover','Dunlin','Western Sandpiper','Marbled Godwit','Whimbrel','Greater Yellowlegs','Caspian Tern','Brant'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=3, progress:Math.min(n,3), total:3, detail:n+'/8 estuary spp'};
    }},
  { id:'pnw_est2', category:'pnw_pack', tier:2, icon:'🦀',
    name:'The Estuary Keeper',
    desc:'5 estuary species. Mudflats, tide charts, ten thousand wings.',
    compute:function(s){
      var list=['Black-bellied Plover','Dunlin','Western Sandpiper','Marbled Godwit','Whimbrel','Greater Yellowlegs','Caspian Tern','Brant'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=5, progress:Math.min(n,5), total:5, detail:n+'/8 estuary spp'};
    }},
  { id:'pnw_est3', category:'pnw_pack', tier:3, icon:'🦀',
    name:'Tide Reader',
    desc:'7 of 8 estuary species.',
    compute:function(s){
      var list=['Black-bellied Plover','Dunlin','Western Sandpiper','Marbled Godwit','Whimbrel','Greater Yellowlegs','Caspian Tern','Brant'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=7, progress:Math.min(n,7), total:7, detail:n+'/8 estuary spp'};
    }},
  { id:'pnw_est4', category:'pnw_pack', tier:5, icon:'🦀',
    name:'All Eight Estuary Birds',
    desc:'All 8 estuary species. The mudflat holds nothing back.',
    compute:function(s){
      var list=['Black-bellied Plover','Dunlin','Western Sandpiper','Marbled Godwit','Whimbrel','Greater Yellowlegs','Caspian Tern','Brant'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=8, progress:Math.min(n,8), total:8, detail:n+'/8 estuary spp'};
    }},

  // ══════════════════════════════════════════════════════════
  // 👁  SKULK & SEEK
  // ══════════════════════════════════════════════════════════

  // The Thicket Oracle — heard-only species (experimental)
  { id:'sp_tho1', category:'species', tier:1, icon:'👂',
    name:'What Was That?',
    desc:'10 species logged as heard-only (count=0). The ears have it.',
    compute:function(s){ return{earned:s.heardOnlySpeciesCount>=10,  progress:Math.min(s.heardOnlySpeciesCount,10),  total:10,  detail:'(experimental)'}; }},
  { id:'sp_tho2', category:'species', tier:2, icon:'👂',
    name:'The Thicket Oracle',
    desc:'25 heard-only species. You never saw them. You knew them anyway.',
    compute:function(s){ return{earned:s.heardOnlySpeciesCount>=25,  progress:Math.min(s.heardOnlySpeciesCount,25),  total:25,  detail:'(experimental)'}; }},
  { id:'sp_tho3', category:'species', tier:3, icon:'👂',
    name:'Ear Birder',
    desc:'50 heard-only species.',
    compute:function(s){ return{earned:s.heardOnlySpeciesCount>=50,  progress:Math.min(s.heardOnlySpeciesCount,50),  total:50,  detail:'(experimental)'}; }},
  { id:'sp_tho4', category:'species', tier:5, icon:'👂',
    name:'The Dark Fluent',
    desc:'100 heard-only species. A superpower most birders never develop.',
    compute:function(s){ return{earned:s.heardOnlySpeciesCount>=100, progress:Math.min(s.heardOnlySpeciesCount,100), total:100, detail:'(experimental)'}; }},

  // The King's Ransom — NA rail completion badge
  { id:'sp_kr1', category:'species', tier:1, icon:'🌾',
    name:'Into the Marsh',
    desc:'3 of 8 North American rail species. They\'re in there. You found them.',
    compute:function(s){
      var list=['Virginia Rail','Sora','King Rail','Clapper Rail','Black Rail','Yellow Rail','Purple Gallinule','Common Gallinule'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=3, progress:Math.min(n,3), total:3, detail:n+'/8 rails'};
    }},
  { id:'sp_kr2', category:'species', tier:2, icon:'🌾',
    name:'The King\'s Ransom',
    desc:'5 of 8 NA rails. You wade.',
    compute:function(s){
      var list=['Virginia Rail','Sora','King Rail','Clapper Rail','Black Rail','Yellow Rail','Purple Gallinule','Common Gallinule'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=5, progress:Math.min(n,5), total:5, detail:n+'/8 rails'};
    }},
  { id:'sp_kr3', category:'species', tier:3, icon:'🌾',
    name:'Rail Lord',
    desc:'7 of 8 NA rails. Black Rail or Yellow Rail is still out there.',
    compute:function(s){
      var list=['Virginia Rail','Sora','King Rail','Clapper Rail','Black Rail','Yellow Rail','Purple Gallinule','Common Gallinule'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=7, progress:Math.min(n,7), total:7, detail:n+'/8 rails'};
    }},
  { id:'sp_kr4', category:'species', tier:5, icon:'🌾',
    name:'Every Rail Kneels',
    desc:'All 8 NA rail species. A lifetime of marshes.',
    compute:function(s){
      var list=['Virginia Rail','Sora','King Rail','Clapper Rail','Black Rail','Yellow Rail','Purple Gallinule','Common Gallinule'];
      var n=_speciesFromList(s._speciesSeen,list);
      return{earned:n>=8, progress:Math.min(n,8), total:8, detail:n+'/8 rails'};
    }},

  // The Wingspan Sovereign — large-wingspan species
  { id:'sp_ws1', category:'species', tier:1, icon:'🦅',
    name:'Giants Noticed',
    desc:'8 species with a wingspan over 150 cm — condors, cranes, eagles, swans, pelicans, albatrosses.',
    compute:function(s){
      var n=_speciesFromList(s._speciesSeen,_WINGSPAN_SP);
      return{earned:n>=8,  progress:Math.min(n,8),  total:8,  detail:n+' of '+_WINGSPAN_SP.length+' giants'};
    }},
  { id:'sp_ws2', category:'species', tier:2, icon:'🦅',
    name:'The Wingspan Sovereign',
    desc:'15 large-wingspan species. The giants of the air answer to you.',
    compute:function(s){
      var n=_speciesFromList(s._speciesSeen,_WINGSPAN_SP);
      return{earned:n>=15, progress:Math.min(n,15), total:15, detail:n+' of '+_WINGSPAN_SP.length+' giants'};
    }},
  { id:'sp_ws3', category:'species', tier:3, icon:'🦅',
    name:'Commanding the Sky',
    desc:'25 large-wingspan species.',
    compute:function(s){
      var n=_speciesFromList(s._speciesSeen,_WINGSPAN_SP);
      return{earned:n>=25, progress:Math.min(n,25), total:25, detail:n+' of '+_WINGSPAN_SP.length+' giants'};
    }},
  { id:'sp_ws4', category:'species', tier:5, icon:'🦅',
    name:'Sovereign of All Skies',
    desc:'35 large-wingspan species. Pelagic trips, cranes, condors — all of it.',
    compute:function(s){
      var n=_speciesFromList(s._speciesSeen,_WINGSPAN_SP);
      return{earned:n>=35, progress:Math.min(n,35), total:35, detail:n+' of '+_WINGSPAN_SP.length+' giants'};
    }},

  // County Cartographer — counties with 100+ species (depth, not breadth)
  { id:'geo_cc1', category:'geo', tier:1, icon:'🗺️',
    name:'Century County',
    desc:'1 county where you\'ve recorded 100+ species. You know this ground.',
    compute:function(s){ return{earned:s.countiesOver100sp>=1,  progress:Math.min(s.countiesOver100sp,1),  total:1};  }},
  { id:'geo_cc2', category:'geo', tier:2, icon:'🗺️',
    name:'County Cartographer',
    desc:'3 counties with 100+ species. A real map of places you\'ve worked.',
    compute:function(s){ return{earned:s.countiesOver100sp>=3,  progress:Math.min(s.countiesOver100sp,3),  total:3};  }},
  { id:'geo_cc3', category:'geo', tier:3, icon:'🗺️',
    name:'Deep Cartographer',
    desc:'10 counties with 100+ species.',
    compute:function(s){ return{earned:s.countiesOver100sp>=10, progress:Math.min(s.countiesOver100sp,10), total:10}; }},
  { id:'geo_cc4', category:'geo', tier:5, icon:'🗺️',
    name:'Master Cartographer',
    desc:'25 counties with 100+ species. County listing at its most serious.',
    compute:function(s){ return{earned:s.countiesOver100sp>=25, progress:Math.min(s.countiesOver100sp,25), total:25}; }},

];

// ─────────────────────────────────────────────────────────────
// WINGSPAN SPECIES LIST (avg wingspan > ~150 cm)
// ─────────────────────────────────────────────────────────────
var _WINGSPAN_SP = [
  'California Condor','Turkey Vulture','Black Vulture',
  'Whooping Crane','Sandhill Crane',
  'American White Pelican','Brown Pelican',
  'Trumpeter Swan','Tundra Swan','Mute Swan','Whooper Swan',
  'Bald Eagle','Golden Eagle','White-tailed Eagle','Steller\'s Sea-Eagle',
  'Great Blue Heron','Great Egret',
  'Wandering Albatross','Short-tailed Albatross','Laysan Albatross',
  'Black-footed Albatross','Yellow-nosed Albatross','Black-browed Albatross',
  'Magnificent Frigatebird','Great Frigatebird','Lesser Frigatebird',
  'Northern Gannet','Masked Booby','Nazca Booby',
  'Jabiru',
  'Greater White-fronted Goose',
];

// ─────────────────────────────────────────────────────────────
// QUEST → BADGE POPUP CONTENT MAP
// Maps quest id to a badge_id key in BADGE_POPUP.
// Used to look up rich popup content when a user clicks a badge.
// ─────────────────────────────────────────────────────────────
var QUEST_BADGE_MAP = {
  // fledgling / chronicle
  'ded_1':'the_fledgling',
  'ded_2':'the_chronicler','ded_3':'the_chronicler','ded_4':'the_chronicler',
  'ded_5':'the_chronicler','ded_6':'the_chronicler','ded_7':'the_chronicler','ded_8':'the_chronicler',
  // geographic
  'geo_st1':'the_pilgrim','geo_st2':'the_pilgrim','geo_st3':'the_pilgrim',
  'geo_st4':'the_pilgrim','geo_st5':'the_pilgrim',
  'geo_ct1':'the_continental','geo_ct2':'the_continental','geo_ct3':'the_continental',
  'geo_ct4':'the_continental','geo_ct5':'the_continental',
  'geo_cc1':'county_cartographer','geo_cc2':'county_cartographer',
  'geo_cc3':'county_cartographer','geo_cc4':'county_cartographer',
  // temporal — big day
  'tmp_bd1':'the_centurion','tmp_bd2':'the_centurion','tmp_bd3':'the_centurion',
  'tmp_bd4':'the_centurion','tmp_bd5':'the_centurion',
  // temporal — dawn
  'tmp_dw1':'the_dawnbreaker','tmp_dw2':'the_dawnbreaker','tmp_dw3':'the_dawnbreaker',
  'tmp_dw4':'the_dawnbreaker','tmp_dw5':'the_dawnbreaker',
  // temporal — migration / winter / midnight
  'tmp_mig1':'migration_rider','tmp_mig2':'migration_rider',
  'tmp_mig3':'migration_rider','tmp_mig4':'migration_rider',
  'tmp_win1':'winter_holdout','tmp_win2':'winter_holdout',
  'tmp_win3':'winter_holdout','tmp_win4':'winter_holdout',
  'tmp_mid1':'the_midnight_communion','tmp_mid2':'the_midnight_communion',
  'tmp_mid3':'the_midnight_communion','tmp_mid4':'the_midnight_communion',
  // species
  'sp_owl1':'the_owl_caller','sp_owl2':'the_owl_caller','sp_owl3':'the_owl_caller',
  'sp_owl4':'the_owl_caller','sp_owl5':'the_owl_caller',
  'sp_rap1':'the_raptors_gaze','sp_rap2':'the_raptors_gaze','sp_rap3':'the_raptors_gaze',
  'sp_rap4':'the_raptors_gaze','sp_rap5':'the_raptors_gaze',
  'sp_wa1':'the_warbler_weaver','sp_wa2':'the_warbler_weaver','sp_wa3':'the_warbler_weaver',
  'sp_wa4':'the_warbler_weaver','sp_wa5':'the_warbler_weaver',
  'sp_sh1':'the_shore_mystic','sp_sh2':'the_shore_mystic','sp_sh3':'the_shore_mystic',
  'sp_sh4':'the_shore_mystic','sp_sh5':'the_shore_mystic',
  'sp_sp1':'the_little_brown_sage','sp_sp2':'the_little_brown_sage','sp_sp3':'the_little_brown_sage',
  'sp_sp4':'the_little_brown_sage','sp_sp5':'the_little_brown_sage',
  'sp_hu1':'the_nectar_baron','sp_hu2':'the_nectar_baron','sp_hu3':'the_nectar_baron',
  'sp_hu4':'the_nectar_baron','sp_hu5':'the_nectar_baron',
  'sp_wp1':'the_drummers_circle','sp_wp2':'the_drummers_circle','sp_wp3':'the_drummers_circle',
  'sp_wp4':'the_drummers_circle','sp_wp5':'the_drummers_circle',
  'sp_gu1':'the_larophiles_burden','sp_gu2':'the_larophiles_burden','sp_gu3':'the_larophiles_burden',
  'sp_gu4':'the_larophiles_burden','sp_gu5':'the_larophiles_burden',
  'sp_bw1':'breeding_witness','sp_bw2':'breeding_witness',
  'sp_bw3':'breeding_witness','sp_bw4':'breeding_witness',
  'sp_ra1':'the_marsh_phantom','sp_ra2':'the_marsh_phantom',
  'sp_ra3':'the_marsh_phantom','sp_ra4':'the_marsh_phantom',
  'sp_wr1':'the_silent_witness','sp_wr2':'the_silent_witness',
  'sp_wr3':'the_silent_witness','sp_wr4':'the_silent_witness',
  'sp_tho1':'the_thicket_oracle','sp_tho2':'the_thicket_oracle',
  'sp_tho3':'the_thicket_oracle','sp_tho4':'the_thicket_oracle',
  'sp_kr1':'kings_ransom','sp_kr2':'kings_ransom','sp_kr3':'kings_ransom','sp_kr4':'kings_ransom',
  'sp_ws1':'the_wingspan_sovereign','sp_ws2':'the_wingspan_sovereign',
  'sp_ws3':'the_wingspan_sovereign','sp_ws4':'the_wingspan_sovereign',
  // on-ramp
  'on_comp':'the_completionist',
  'on_scr1':'the_scribe','on_scr2':'the_scribe','on_scr3':'the_scribe','on_scr4':'the_scribe',
  'on_en1':'the_enumerator','on_en2':'the_enumerator','on_en3':'the_enumerator','on_en4':'the_enumerator',
  // quirk
  'qk_sit1':'the_big_sit','qk_sit2':'the_big_sit','qk_sit3':'the_big_sit','qk_sit4':'the_big_sit',
  'qk_dm1':'the_death_march','qk_dm2':'the_death_march','qk_dm3':'the_death_march','qk_dm4':'the_death_march',
  'qk_phen1':'the_phenologist','qk_phen2':'the_phenologist',
  'qk_phen3':'the_phenologist','qk_phen4':'the_phenologist',
  'qk_ny1':'new_years_devotee','qk_ny2':'new_years_devotee',
  'qk_ny3':'new_years_devotee','qk_ny4':'new_years_devotee',
  'qk_leap':'the_leap_lister',
  'qk_loy1':'the_loyalist','qk_loy2':'the_loyalist','qk_loy3':'the_loyalist','qk_loy4':'the_loyalist',
  'qk_patch1':'location_loyalty','qk_patch2':'location_loyalty',
  'qk_patch3':'location_loyalty','qk_patch4':'location_loyalty',
  // PNW pack
  'pnw_dip1':'dippers_creed','pnw_dip2':'dippers_creed','pnw_dip3':'dippers_creed','pnw_dip4':'dippers_creed',
  'pnw_sal1':'salmonberry_circuit','pnw_sal2':'salmonberry_circuit',
  'pnw_sal3':'salmonberry_circuit','pnw_sal4':'salmonberry_circuit',
  'pnw_sag1':'sagebrush_sea','pnw_sag2':'sagebrush_sea',
  'pnw_sag3':'sagebrush_sea','pnw_sag4':'sagebrush_sea',
  'pnw_alc1':'alcid_ascetic','pnw_alc2':'alcid_ascetic','pnw_alc3':'alcid_ascetic','pnw_alc4':'alcid_ascetic',
  'pnw_mal1':'malheur_pilgrimage','pnw_mal2':'malheur_pilgrimage',
  'pnw_mal3':'malheur_pilgrimage','pnw_mal4':'malheur_pilgrimage',
  'pnw_est1':'estuary_keeper','pnw_est2':'estuary_keeper',
  'pnw_est3':'estuary_keeper','pnw_est4':'estuary_keeper',
};

// ─────────────────────────────────────────────────────────────
// BADGE POPUP CONTENT
// Static display content for each badge group.
// Keyed by badge_id (matches QUEST_BADGE_MAP values).
// ─────────────────────────────────────────────────────────────
var BADGE_POPUP = {
  the_fledgling:{
    name:'The Fledgling',flavor:'Every birder has a first checklist. This one is yours.',
    how_it_works:'Awarded the moment your upload contains at least one checklist. We show the date of your earliest checklist so you can see where the story begins.',
    tier_unit:'checklists',tiers:null,
    progress_display:'Fledged on {first_checklist_date}',
    field_tips:['You already earned this — welcome to the roost.','Your first checklist date is a fun anchor. Compare it with friends to see who\'s the elder birder.'],
  },
  the_completionist:{
    name:'The Completionist',flavor:'Reporting everything you saw, not just the good stuff.',
    how_it_works:'The share of your checklists marked as complete (\'All Obs Reported\' = yes). We require at least 20 checklists so the percentage means something.',
    tier_unit:'percent complete',tiers:{bronze:90,silver:95,gold:98,legendary:100},
    progress_display:'{value}% of your checklists are complete — {next_threshold}% for {next_tier_name}',
    field_tips:['Complete checklists are the ones scientists can actually use. This badge rewards good data citizenship, not big numbers.','In the eBird app, answer \'Are you submitting a complete checklist?\' with Yes whenever you reported every bird you could identify.','It\'s fine to say No for incidental sightings — this badge just measures the ratio.'],
  },
  the_scribe:{
    name:'The Scribe',flavor:'The birder who writes it down.',
    how_it_works:'Counts observations where you left a species comment. Behavior notes, plumage details, breeding activity — anything in the comment field counts.',
    tier_unit:'commented observations',tiers:{bronze:10,silver:50,gold:200,legendary:1000},
    progress_display:'{value} commented observations — {next_threshold} for {next_tier_name}',
    field_tips:['A quick note like \'carrying nesting material\' or \'singing from cattails\' turns a tally into a record.','Comments are where rarities get documented. Future-you (and reviewers) will thank present-you.'],
  },
  the_enumerator:{
    name:'The Enumerator',flavor:'Count the birds. All of them.',
    how_it_works:'Counts checklists where every species has a real number — no \'X\' (present but uncounted) anywhere on the list.',
    tier_unit:'fully-counted checklists',tiers:{bronze:25,silver:100,gold:500,legendary:2000},
    progress_display:'{value} fully-counted checklists — {next_threshold} for {next_tier_name}',
    field_tips:['Actual counts (even estimates) are far more valuable than \'X\'. Ten Mallards tells a story; \'X Mallard\' doesn\'t.','For big flocks, estimate by tens or hundreds rather than defaulting to X.','One \'X\' disqualifies the whole checklist for this badge, so it rewards consistent habit.'],
  },
  the_centurion:{
    name:'The Centurion',flavor:'A single day. A hundred birds. A legend.',
    how_it_works:'Your best single-day species total. We group all your checklists by date, count distinct species per day, and take your highest day.',
    tier_unit:'species in one day',tiers:{bronze:50,silver:75,gold:100,legendary:150},
    progress_display:'Best day: {value} species — {next_threshold} for {next_tier_name}',
    field_tips:['Big Days are built on habitat variety: hit water, woods, field, and shore in one day.','Spring migration mornings stack species fastest. Start before dawn, end after dusk.','150 (Legendary) usually means a coordinated route in a rich region during peak migration.'],
  },
  the_chronicler:{
    name:'The Chronicler',flavor:'Not the rarest list. The longest devotion.',
    how_it_works:'Your lifetime count of distinct checklists.',
    tier_unit:'checklists',tiers:{bronze:25,silver:100,gold:500,legendary:2000},
    progress_display:'{value} checklists submitted — {next_threshold} for {next_tier_name}',
    field_tips:['Short lists count too. A five-minute stationary count on your porch is a full checklist.','Consistency beats intensity here — a daily patch list adds up faster than occasional marathons.'],
  },
  the_dawnbreaker:{
    name:'The Dawnbreaker',flavor:'The birds are loudest before the world wakes.',
    how_it_works:'Counts distinct checklists that started before 6:00 AM (local time as recorded on the checklist).',
    tier_unit:'pre-dawn checklists',tiers:{bronze:5,silver:10,gold:25,legendary:100},
    progress_display:'{value} checklists before 6 AM — {next_threshold} for {next_tier_name}',
    field_tips:['The dawn chorus peaks in late spring — May mornings are prime for this badge.','Owling counts too, if your start time lands before 6.','Set the start time honestly; the badge reads the time you entered on the checklist.'],
    caveats:['Checklists with no start time recorded can\'t be counted.'],
  },
  the_midnight_communion:{
    name:'The Midnight Communion',flavor:'The quiet hours belong to the truly obsessed.',
    how_it_works:'Counts checklists with a start time between midnight and 3:00 AM.',
    tier_unit:'midnight checklists',tiers:{bronze:1,silver:5,gold:15,legendary:50},
    progress_display:'{value} after-midnight checklists — {next_threshold} for {next_tier_name}',
    field_tips:['Nocturnal migration, owl surveys, and rail playback windows all live here.','A single midnight checklist earns Bronze — most birders never log one.','Big Day teams often start at 12:01 AM to squeeze out owls and nightjars.'],
    caveats:['Needs a recorded start time. Missing-time checklists are skipped.'],
  },
  migration_rider:{
    name:'Migration Rider',flavor:'Ride the wave north.',
    how_it_works:'Your best spring: distinct species recorded between April 1 and May 31 in a single year.',
    tier_unit:'spring species',tiers:{bronze:40,silver:60,gold:75,legendary:125},
    progress_display:'Best spring: {value} species — {next_threshold} for {next_tier_name}',
    field_tips:['Warblers, vireos, tanagers, and flycatchers arrive in waves — bird often through late April and May.','Fallout days after a passing front can add a dozen species in a morning.','125 (Legendary) rewards birders who chase multiple habitats through the whole window.'],
  },
  winter_holdout:{
    name:'Winter Holdout',flavor:'When the fair-weather birders go home.',
    how_it_works:'Your best winter: distinct species recorded between December 1 and January 31, counting a winter that spans the year boundary as one season.',
    tier_unit:'winter species',tiers:{bronze:20,silver:30,gold:40,legendary:75},
    progress_display:'Best winter: {value} species — {next_threshold} for {next_tier_name}',
    field_tips:['Winter waterfowl, gulls, and lingering half-hardies drive this total.','Coastal and open-water sites stay productive when inland woods go quiet.','Because a winter straddles New Year\'s, a December push plus a January follow-up stack into the same season.'],
  },
  breeding_witness:{
    name:'Breeding Witness',flavor:'You didn\'t just see it. You saw it nesting.',
    how_it_works:'Counts distinct species for which you recorded a confirmed breeding code (nest with young, fledglings, carrying food, and similar).',
    tier_unit:'confirmed-breeding species',tiers:{bronze:3,silver:6,gold:10,legendary:25},
    progress_display:'{value} species confirmed breeding — {next_threshold} for {next_tier_name}',
    detail:'Confirmed codes: NY (nest w/ young), NE (nest w/ eggs), FS (carrying fecal sac), FY (feeding young), CF (carrying food), ON (occupied nest), UN (used nest), DD (distraction display).',
    field_tips:['Only \'Confirmed\' codes count — \'Possible\' (singing) and \'Probable\' don\'t move this badge.','Watch for adults carrying food or fecal sacs; that\'s an easy confirmation without ever finding a nest.','Breeding Bird Atlas projects are a great structured way to rack these up.'],
  },
  the_raptors_gaze:{
    name:'The Raptor\'s Gaze',flavor:'Eyes on the sky, always.',
    how_it_works:'Counts distinct raptor species on your life list — hawks, eagles, kites, harriers (Accipitridae), falcons and caracaras (Falconidae), and Osprey (Pandionidae).',
    tier_unit:'raptor species',tiers:{bronze:8,silver:14,gold:20,legendary:30},
    progress_display:'{value} raptor species — {next_threshold} for {next_tier_name}',
    field_tips:['Hawkwatch sites in fall are the fastest way to add species and study flight ID.','Don\'t overlook the falcons: kestrel, merlin, peregrine, and prairie each count separately.','Owls are NOT raptors for this badge — they have their own (The Owl Caller).'],
  },
  the_warbler_weaver:{
    name:'The Warbler Weaver',flavor:'The confetti of migration.',
    how_it_works:'Counts distinct New World warbler species (family Parulidae) on your life list.',
    tier_unit:'warbler species',tiers:{bronze:10,silver:18,gold:25,legendary:35},
    progress_display:'{value} warbler species — {next_threshold} for {next_tier_name}',
    field_tips:['Spring migration is warbler prime time — learn the songs and your list explodes.','Eastern North America holds far more warbler diversity than the West; 35 (Legendary) usually means travel.','Fall \'confusing\' warblers count the same as crisp spring males — plumage doesn\'t matter, the species does.'],
  },
  the_shore_mystic:{
    name:'The Shore Mystic',flavor:'Reading the mudflat like scripture.',
    how_it_works:'Counts distinct shorebird species — sandpipers and allies (Scolopacidae) plus plovers (Charadriidae).',
    tier_unit:'shorebird species',tiers:{bronze:12,silver:20,gold:30,legendary:40},
    progress_display:'{value} shorebird species — {next_threshold} for {next_tier_name}',
    field_tips:['Time the tides: a rising tide pushes birds close, a falling tide spreads them out.','Fall migration (July–September) brings the widest variety, including juveniles.','Estuaries, sewage ponds, and flooded fields are the classic shorebird magnets.'],
  },
  the_owl_caller:{
    name:'The Owl Caller',flavor:'You speak to the dark, and the dark answers.',
    how_it_works:'Counts distinct owl species — typical owls (Strigidae) and barn owls (Tytonidae).',
    tier_unit:'owl species',tiers:{bronze:3,silver:5,gold:8,legendary:12},
    progress_display:'{value} owl species — {next_threshold} for {next_tier_name}',
    field_tips:['Learn calls — most owls are heard far more often than seen.','Winter is prime for northern visitors; check daytime roosts in dense conifers.','Please bird ethically: limit or avoid playback, especially near nests and in heavily-birded spots.'],
  },
  the_marsh_phantom:{
    name:'The Marsh Phantom',flavor:'Heard everywhere. Seen almost never.',
    how_it_works:'Counts distinct rail-family species (Rallidae) — rails, sora, gallinules, coots, crakes.',
    tier_unit:'rail-family species',tiers:{bronze:3,silver:5,gold:8,legendary:12},
    progress_display:'{value} rail-family species — {next_threshold} for {next_tier_name}',
    field_tips:['Dawn and dusk in freshwater marsh are your best windows.','Coots and gallinules are the gimmes; Virginia Rail and Sora take patience; Yellow and Black Rail are the grails.','Heard-only counts — most rail records are audio.'],
  },
  the_silent_witness:{
    name:'The Silent Witness',flavor:'Small, loud, and everywhere you look — once you learn to look.',
    how_it_works:'Counts distinct wren species (family Troglodytidae).',
    tier_unit:'wren species',tiers:{bronze:4,silver:7,gold:10,legendary:15},
    progress_display:'{value} wren species — {next_threshold} for {next_tier_name}',
    field_tips:['Wrens are ventriloquists of the understory — learn songs to find the skulkers.','The Southwest holds the most diversity (Cactus, Rock, Canyon, Bewick\'s, and more).','Marsh and Sedge Wrens hide in wet grass; Pacific and Winter Wrens run the forest floor.'],
  },
  the_wingspan_sovereign:{
    name:'The Wingspan Sovereign',flavor:'The giants of the air answer to you.',
    how_it_works:'Counts distinct species from our curated large-wingspan list (average wingspan over ~150 cm) — condors, albatrosses, cranes, pelicans, swans, the largest eagles and herons.',
    tier_unit:'large-wingspan species',tiers:{bronze:8,silver:15,gold:25,legendary:35},
    progress_display:'{value} giants on your list — {next_threshold} for {next_tier_name}',
    field_tips:['Pelagic trips unlock albatrosses and the biggest tubenoses.','Swans, cranes, and pelicans are the accessible tier; California Condor is the trophy.','See the badge\'s species list to check which of your birds qualify.'],
  },
  the_thicket_oracle:{
    name:'The Thicket Oracle',flavor:'You never saw it. You knew it anyway.',
    how_it_works:'Counts distinct species you logged as heard-only. eBird encodes this quietly, so we treat it as experimental and show you which records we matched.',
    tier_unit:'heard-only species',tiers:{bronze:10,silver:25,gold:50,legendary:100},
    progress_display:'{value} heard-only species (experimental) — {next_threshold} for {next_tier_name}',
    field_tips:['Birding by ear is a superpower — this badge celebrates it.','Rails, owls, nightjars, and dense-cover skulkers are the classic heard-only birds.','Adding \'heard only\' in your species comment helps us match these more reliably.'],
    caveats:['Experimental: eBird\'s export encodes heard-only as count=0. This count may be conservative — some heard birds are logged with a numeric count anyway.'],
  },
  kings_ransom:{
    name:'The King\'s Ransom',flavor:'Every rail in the kingdom, bowed before you.',
    how_it_works:'A completion badge: have you recorded the full set of North American rails and allies? We check your list against the target species set.',
    tier_unit:'target species found',tiers:{bronze:3,silver:5,gold:7,legendary:8},
    progress_display:'{value} of 8 target rails — {next_threshold} for {next_tier_name}',
    detail:'Target set: Virginia Rail, Sora, King Rail, Clapper Rail, Black Rail, Yellow Rail, Purple Gallinule, Common Gallinule.',
    field_tips:['Black and Yellow Rail are the make-or-break Legendary birds — both demand effort and often night marsh work.','King vs. Clapper can hinge on habitat (fresh vs. salt) as much as looks.','This one rewards a lifetime of marsh dedication, not a single trip.'],
  },
  county_cartographer:{
    name:'County Cartographer',flavor:'Filling in the map, one county at a time.',
    how_it_works:'Counts how many counties you\'ve turned into a serious list — a county qualifies once you\'ve recorded 100+ species there.',
    tier_unit:'counties with 100+ species',tiers:{bronze:1,silver:3,gold:10,legendary:25},
    progress_display:'{value} counties over 100 species — {next_threshold} for {next_tier_name}',
    field_tips:['County listing is a rabbit hole in the best way — it sends you to habitats you\'d otherwise skip.','Your home county usually clears 100 first; road trips fill in the rest.','Diverse counties (coast + mountains + valley) hit 100 far more easily than uniform ones.'],
  },
  location_loyalty:{
    name:'The Rooted (Patch Loyalty)',flavor:'Know one place completely.',
    how_it_works:'Your maximum number of checklists at a single location. This is a four-rung ladder rewarding deep local patch-birding.',
    tier_unit:'checklists at one location',tiers:{bronze:10,silver:25,gold:100,legendary:365},
    progress_display:'{value} checklists at your top patch — {next_threshold} for {next_tier_name}',
    detail:'Tier names: Bronze = The Patchling, Silver = The Neighborhood Naturalist, Gold = The Patch Warden, Legendary = The Rooted.',
    field_tips:['Pick a patch you can visit often — a local park, a wetland, even your yard.','Patch birding teaches phenology: you learn exactly when each species arrives and leaves.','The Rooted (365) is roughly a year of near-daily visits, or many years of regular ones.'],
  },
  the_big_sit:{
    name:'The Big Sit',flavor:'Plant yourself. Let the birds come to you.',
    how_it_works:'Your longest stationary count. We look at single checklists using the Stationary protocol and take the longest duration.',
    tier_unit:'minutes (single stationary count)',tiers:{bronze:180,silver:300,gold:480,legendary:720},
    progress_display:'Longest sit: {value} min — {next_threshold} min for {next_tier_name}',
    field_tips:['A true \'Big Sit\' picks one spot with a wide view — a seawatch point, a hawk ridge, a marsh overlook.','Legendary (720 min) is a 12-hour vigil. Bring snacks, sunscreen, and a chair.','Only Stationary-protocol checklists count — if you wandered, it\'s a traveling count.'],
  },
  the_death_march:{
    name:'The Death March',flavor:'The birds were worth every mile. Probably.',
    how_it_works:'Your longest single traveling count, by distance.',
    tier_unit:'km (single traveling count)',tiers:{bronze:8,silver:15,gold:25,legendary:40},
    progress_display:'Longest march: {value} km — {next_threshold} km for {next_tier_name}',
    field_tips:['Keep one continuous checklist for the whole trek — don\'t split it — to log the full distance.','Backcountry and alpine hikes are natural Death Marches with great birds as the payoff.','40 km (Legendary) is a serious day on foot. Tell someone where you\'re going.'],
  },
  the_phenologist:{
    name:'The Phenologist',flavor:'You know a place through every season it wears.',
    how_it_works:'The maximum number of distinct calendar months (Jan–Dec, across all years combined) in which you\'ve birded a single location. Legendary requires all 12 months at three or more locations.',
    tier_unit:'months covered at one location',tiers:{bronze:8,silver:10,gold:12,legendary:12},
    progress_display:'{value} of 12 months at your best-covered site — {next_threshold} for {next_tier_name}',
    detail:'Legendary = all 12 months at 3+ separate locations.',
    field_tips:['This is the badge for patch loyalty over rarity-chasing — our favorite in the whole system.','January and the deep-summer doldrums are the months people miss; go bird them anyway.','You don\'t need a checklist every week — just at least one visit in each month, over any span of years.'],
  },
  new_years_devotee:{
    name:'New Year\'s Devotee',flavor:'While the world sleeps off the party, you\'re already listing.',
    how_it_works:'Your longest streak of consecutive years with a checklist on January 1st.',
    tier_unit:'consecutive New Year\'s Days',tiers:{bronze:2,silver:3,gold:5,legendary:10},
    progress_display:'{value}-year Jan 1 streak — {next_threshold} for {next_tier_name}',
    field_tips:['Jan 1 is the traditional \'year list reset\' — birders everywhere hit the field to start fresh.','Even a short backyard list keeps the streak alive.','Miss a year and the streak resets, so this rewards ritual as much as birding.'],
  },
  the_leap_lister:{
    name:'The Leap Lister',flavor:'A bird for the day that barely exists.',
    how_it_works:'Awarded if you\'ve ever submitted a checklist on February 29th.',
    tier_unit:'leap-day checklists',tiers:null,
    progress_display:'Leap Day birder ✓',
    field_tips:['Only comes around every four years — mark your calendar for the next one.','Pure whimsy. Any checklist on Feb 29 earns it.'],
  },
  the_loyalist:{
    name:'The Loyalist',flavor:'Everyone has a bird. Here\'s yours.',
    how_it_works:'Finds the single species that appears on the most of your checklists, and counts those checklists. We show you which bird it is.',
    tier_unit:'checklists featuring your top species',tiers:{bronze:50,silver:100,gold:200,legendary:500},
    progress_display:'Your bird is {top_species}, on {value} checklists — {next_threshold} for {next_tier_name}',
    field_tips:['It\'s almost always a common local backyard bird — and that\'s the charm.','Compare your bird with friends\'; it\'s a surprisingly personal fingerprint of where you bird.'],
  },
  the_pilgrim:{
    name:'The Pilgrim',flavor:'Home is where the checklist is.',
    how_it_works:'Counts the distinct states and provinces where you\'ve birded.',
    tier_unit:'states/provinces',tiers:{bronze:2,silver:5,gold:10,legendary:25},
    progress_display:'{value} states/provinces birded — {next_threshold} for {next_tier_name}',
    field_tips:['A checklist from the airport layover counts — bird everywhere you travel.','Road trips are the fastest way to stack states.','25 (Legendary) is half the US, or a well-traveled continental lister.'],
  },
  the_continental:{
    name:'The Continental',flavor:'Passport stamps, measured in birds.',
    how_it_works:'Counts the distinct countries where you\'ve birded, read from the country code on each checklist.',
    tier_unit:'countries',tiers:{bronze:2,silver:3,gold:5,legendary:8},
    progress_display:'{value} countries birded — {next_threshold} for {next_tier_name}',
    field_tips:['Even one checklist abroad opens a whole new avifauna — and this badge.','Neotropical trips can add hundreds of lifers alongside a new country.','Bird the trip, not just the tour — log your own checklists wherever you go.'],
  },
  the_larophiles_burden:{
    name:'The Larophile\'s Burden',flavor:'Nobody chooses to love gulls. It chooses you.',
    how_it_works:'Counts distinct gull and kittiwake species on your list. We match by name and exclude hybrids and unidentified \'gull sp.\' so only true species count.',
    tier_unit:'gull species',tiers:{bronze:6,silver:10,gold:15,legendary:22},
    progress_display:'{value} gull species — {next_threshold} for {next_tier_name}',
    field_tips:['Winter is gull season — landfills, harbors, and river mouths are the classrooms.','Learn the common species cold; the rarities reveal themselves against that baseline.','Hybrids are gulls\' favorite trick — and they don\'t count here, which is honestly a mercy.'],
    caveats:['Hybrid gulls and slash/\'sp.\' records are excluded. Only clean species-level records count.'],
  },
  the_little_brown_sage:{
    name:'The Little Brown Sage',flavor:'Master the little brown jobs and you master birding.',
    how_it_works:'Counts distinct New World sparrow species (family Passerellidae) on your list.',
    tier_unit:'sparrow species',tiers:{bronze:8,silver:14,gold:20,legendary:30},
    progress_display:'{value} sparrow species — {next_threshold} for {next_tier_name}',
    field_tips:['Weedy field edges, brush piles, and marsh margins are sparrow gold.','Late fall and winter concentrate sparrows and mix scarce species into flocks.','Learn chip notes — many sparrows announce themselves before you see them.'],
  },
  the_drummers_circle:{
    name:'The Drummer\'s Circle',flavor:'The forest keeps a beat.',
    how_it_works:'Counts distinct woodpecker species (family Picidae) on your list.',
    tier_unit:'woodpecker species',tiers:{bronze:5,silver:8,gold:12,legendary:18},
    progress_display:'{value} woodpecker species — {next_threshold} for {next_tier_name}',
    field_tips:['Listen for drumming and calls — woodpeckers advertise loudly in late winter and spring.','Burned forest and standing dead timber are magnets, especially for the scarcer species.','The Southwest and mountain West hold the extra species that push toward Legendary.'],
  },
  the_nectar_baron:{
    name:'The Nectar Baron',flavor:'Small, fierce, and impossibly fast.',
    how_it_works:'Counts distinct hummingbird species (family Trochilidae) on your list. Thresholds start low because hummingbird diversity is intensely regional.',
    tier_unit:'hummingbird species',tiers:{bronze:2,silver:4,gold:8,legendary:15},
    progress_display:'{value} hummingbird species — {next_threshold} for {next_tier_name}',
    detail:'Thresholds are deliberately regional — this is a travel incentive as much as a home-patch badge.',
    field_tips:['2 species is a genuine accomplishment in the Pacific Northwest — don\'t underrate Bronze.','Gold and Legendary effectively require the Southwest (SE Arizona is the mecca).','Feeders and flowering natives concentrate hummers; late summer brings the most variety.'],
  },
  dippers_creed:{
    name:'The Dipper\'s Creed',flavor:'The patron bird of cold, clean, fast water. Kneel at the riffle and count your blessings.',
    how_it_works:'Counts your checklists that include American Dipper — the PNW\'s bird of restored, oxygen-rich streams.',
    tier_unit:'checklists with American Dipper',tiers:{bronze:3,silver:10,gold:25,legendary:75},
    progress_display:'{value} Dipper checklists — {next_threshold} for {next_tier_name}',
    field_tips:['Fast, clear mountain streams and forested rivers are prime — look on midstream boulders.','Dippers are indicators of stream health; a reliable dipper reach is a healthy reach.','They\'re resident year-round, so this badge rewards frequent visits to your local river.'],
  },
  salmonberry_circuit:{
    name:'The Salmonberry Circuit',flavor:'The wet-side gauntlet. Fog, moss, and birds that would rather you didn\'t see them.',
    how_it_works:'Counts how many species from the west-side PNW specialty list you\'ve recorded (Varied Thrush, Sooty Grouse, Harlequin Duck, Pacific Wren, Marbled Murrelet, and more).',
    tier_unit:'species from the circuit',tiers:{bronze:4,silver:7,gold:10,legendary:12},
    progress_display:'{value} of 12 circuit species — {next_threshold} for {next_tier_name}',
    detail:'List: Varied Thrush, Sooty Grouse, Harlequin Duck, Black Oystercatcher, Pacific Wren, Marbled Murrelet, Chestnut-backed Chickadee, Red-breasted Sapsucker, Band-tailed Pigeon, Northern Pygmy-Owl, Hermit Warbler, American Dipper.',
    field_tips:['Old-growth and mature conifer forest holds most of these — think mossy, wet, and quiet.','Marbled Murrelet is the toughest: seabird that nests inland in old-growth; dawn coastal watches or known forest sites help.','Hermit Warbler gets harder north of the Columbia due to hybridization — Oregon is the safer bet.'],
  },
  sagebrush_sea:{
    name:'The Sagebrush Sea',flavor:'Cross the mountains. Trade the ferns for silence, distance, and the smell of rain on sage.',
    how_it_works:'Counts how many east-side shrub-steppe specialties you\'ve recorded (Sage Thrasher, Sagebrush Sparrow, Greater Sage-Grouse, Burrowing Owl, and more).',
    tier_unit:'species from the shrub-steppe list',tiers:{bronze:3,silver:5,gold:8,legendary:10},
    progress_display:'{value} of 10 shrub-steppe species — {next_threshold} for {next_tier_name}',
    detail:'List: Greater Sage-Grouse, Sage Thrasher, Sagebrush Sparrow, Brewer\'s Sparrow, Burrowing Owl, Ferruginous Hawk, Long-billed Curlew, Loggerhead Shrike, Prairie Falcon, Rock Wren.',
    field_tips:['This means crossing the Cascades — central and eastern Oregon/Washington sage country.','Spring (April–May) is peak: sparrows sing, grouse display at leks, curlews are back on territory.','Greater Sage-Grouse is the crown jewel; find a lek and arrive well before dawn (from a respectful distance).'],
  },
  alcid_ascetic:{
    name:'The Alcid Ascetic',flavor:'Stand on the headland. Squint at the swells. The sea gives up its monks reluctantly.',
    how_it_works:'Counts how many alcid species (auks, murres, guillemots, murrelets, auklets, puffins) you\'ve recorded from the PNW list.',
    tier_unit:'alcid species',tiers:{bronze:2,silver:4,gold:6,legendary:7},
    progress_display:'{value} of 7 alcid species — {next_threshold} for {next_tier_name}',
    detail:'List: Common Murre, Pigeon Guillemot, Marbled Murrelet, Ancient Murrelet, Cassin\'s Auklet, Rhinoceros Auklet, Tufted Puffin.',
    field_tips:['Rocky headlands with a scope get you the inshore species; a pelagic trip unlocks the rest.','Tufted Puffin is the trophy — try nesting colonies (e.g. Haystack Rock area) in late spring/summer.','Ancient Murrelet and Cassin\'s Auklet usually need a boat or a strong seawatch in the right season.'],
  },
  malheur_pilgrimage:{
    name:'The Malheur Pilgrimage',flavor:'Every PNW birder owes the high desert a spring. Pay your debt at the refuge.',
    how_it_works:'Counts your checklists submitted at Malheur National Wildlife Refuge (Harney County, Oregon).',
    tier_unit:'Malheur checklists',tiers:{bronze:1,silver:5,gold:15,legendary:50},
    progress_display:'{value} checklists at Malheur — {next_threshold} for {next_tier_name}',
    detail:'Matched on Oregon + Harney County + location name containing \'Malheur\'.',
    field_tips:['Late May is legendary — migrant traps like the refuge headquarters oasis pull in vagrants and songbirds.','The auto-tour route, P Ranch, and Benson Pond are the classic stops.','Base out of Frenchglen or Burns; the refuge is vast, so give it multiple days for the higher tiers.'],
  },
  estuary_keeper:{
    name:'The Estuary Keeper',flavor:'Where the river forgets it was ever in a hurry. Mudflats, tide charts, and ten thousand wings.',
    how_it_works:'Counts how many estuary and mudflat specialty species you\'ve recorded from the PNW list (Dunlin, Western Sandpiper, Marbled Godwit, Whimbrel, Brant, and more).',
    tier_unit:'species from the estuary list',tiers:{bronze:3,silver:5,gold:7,legendary:8},
    progress_display:'{value} of 8 estuary species — {next_threshold} for {next_tier_name}',
    detail:'List: Black-bellied Plover, Dunlin, Western Sandpiper, Marbled Godwit, Whimbrel, Greater Yellowlegs, Caspian Tern, Brant.',
    field_tips:['Great PNW estuaries: Willapa Bay, Grays Harbor, Bandon/Coquille, Tillamook, Nehalem.','Bird a rising tide — it concentrates shorebirds close to shore before flooding the flats.','Brant favor eelgrass beds; spring migration (April) is the reliable window for them.'],
  },
};
