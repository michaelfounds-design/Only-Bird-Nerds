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
    dippersCreedCount:   Object.keys(dippersCreedSubs).length,
    malheurCount:        Object.keys(malheurSubs).length,
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

];
