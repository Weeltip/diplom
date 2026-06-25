// Справочник городов и районов ПМР

const PMR_CITIES_PRIMARY = ['Бендеры', 'Тирасполь'];

const PMR_CITIES_ALL = [
  'Бендеры',
  'Варница',
  'Глиное',
  'Григориополь',
  'Днестровск',
  'Дубоссары',
  'Каменка',
  'Кицканы',
  'Корнево',
  'Котовск',
  'Кримичи',
  'Маяк',
  'Новотроицкое',
  'Парканы',
  'Первомайск',
  'Рашков',
  'Рыбница',
  'Слободзея',
  'Суклея',
  'Тирасполь',
  'Чобручи'
];

const PMR_DISTRICTS = {
  Тирасполь: [
    'Центральный',
    'Черновка',
    'Тихвинка',
    'Днестровский',
    'Октябрьский',
    'Красная Горка',
    'Северный',
    'Южный',
    'Западный',
    'Восточный',
    'Кировский',
    'Автозаводской',
    'Комсомольский',
    'Первомайский',
    'Ботанический',
    'Малые сады',
    'Докучаево',
    'Фрунзе',
    'Стадион',
    'Новый город',
    'Карагаш',
    'Мира',
    'Шевченко',
    'Котовского',
    'Ленинский',
    'Суворова'
  ],
  Бендеры: [
    'Центральный',
    'Привокзальный',
    'Левобережный',
    'Суворовский',
    'Восточный',
    'Западный',
    'Южный',
    'Северный',
    'Старый город',
    'Портовый',
    'Рыбный порт',
    'Молдованка',
    'Хаджибей',
    'Придунайский',
    'Крепость',
    'Промышленный',
    'Заводской',
    'Колхозный',
    'Гаражный',
    'Бендеры-1',
    'Бендеры-2',
    'Бендеры-3'
  ],
  Рыбница: [
    'Центральный',
    'Заречный',
    'Северный',
    'Южный',
    'Восточный',
    'Западный',
    'Промышленный',
    'Заводской',
    'Геологический',
    'Микрорайон 1',
    'Микрорайон 2',
    'Микрорайон 3',
    'Квартал 40 лет Победы',
    'Квартал Мира',
    'Посёлок Геологов'
  ],
  Дубоссары: [
    'Центральный',
    'Кировский',
    'Северный',
    'Южный',
    'Правобережный',
    'Левобережный',
    'Заречный',
    'Портовый',
    'Промышленный',
    'Микрорайон 1',
    'Микрорайон 2',
    'Колхозный',
    'Стадион'
  ],
  Слободзея: [
    'Центральный',
    'Портовый',
    'Северный',
    'Южный',
    'Заречный',
    'Восточный',
    'Промышленный',
    'Микрорайон 1',
    'Микрорайон 2',
    'Прибрежный'
  ],
  Григориополь: [
    'Центральный',
    'Котово',
    'Северный',
    'Южный',
    'Заречный',
    'Восточный',
    'Промышленный',
    'Микрорайон',
    'Колхозный'
  ],
  Каменка: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный',
    'Восточный',
    'Промышленный',
    'Микрорайон 1',
    'Микрорайон 2',
    'Рабочий',
    'Колхозный'
  ],
  Днестровск: [
    'Центральный',
    'Северный',
    'Южный',
    'Западный',
    'Восточный',
    'Микрорайон 1',
    'Микрорайон 2',
    'Микрорайон 3',
    'Промышленный',
    'Заводской'
  ],
  Котовск: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный',
    'Промышленный',
    'Микрорайон',
    'Колхозный'
  ],
  Варница: [
    'Центральный',
    'Северный',
    'Южный',
    'Прибрежный',
    'Промышленный'
  ],
  Парканы: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный',
    'Промышленный',
    'Микрорайон'
  ],
  Суклея: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный',
    'Промышленный'
  ],
  Кицканы: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный',
    'Промышленный',
    'Микрорайон 1',
    'Микрорайон 2'
  ],
  Корнево: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный'
  ],
  Кримичи: [
    'Центральный',
    'Северный',
    'Южный'
  ],
  Глиное: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный'
  ],
  Маяк: [
    'Центральный',
    'Северный',
    'Южный',
    'Прибрежный'
  ],
  Новотроицкое: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный'
  ],
  Первомайск: [
    'Центральный',
    'Северный',
    'Южный',
    'Промышленный'
  ],
  Рашков: [
    'Центральный',
    'Северный',
    'Южный',
    'Заречный'
  ],
  Чобручи: [
    'Центральный',
    'Северный',
    'Южный'
  ]
};

const PMR_DISTRICTS_PRIMARY = [
  'Черновка',
  'Центральный',
  'Тихвинка',
  'Днестровский',
  'Привокзальный',
  'Суворовский'
];

function pmrDistrictKey(city, district) {
  return `${city}|${district}`;
}

function pmrParseDistrictKey(key) {
  const [city = '', district = ''] = String(key || '').split('|');
  return { city, district };
}

function pmrGetUniqueDistrictNames() {
  const names = new Set();
  Object.values(PMR_DISTRICTS).forEach((districts) => {
    districts.forEach((district) => names.add(district));
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
}

function pmrGetDistrictNamesForCities(cities) {
  const cityList = cities instanceof Set ? [...cities] : (cities || []);
  if (!cityList.length) return pmrGetUniqueDistrictNames();

  const names = new Set();
  cityList.forEach((city) => {
    pmrGetDistricts(city).forEach((district) => names.add(district));
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
}

function pmrNormalizeLocation(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/^г\.\s*/i, '')
    .replace(/^п\.\s*/i, '')
    .replace(/^пгт\s*/i, '')
    .replace(/р-н\s*/gi, '')
    .trim();
}

function pmrCityHasDistricts(city) {
  return (PMR_DISTRICTS[city] || []).length > 0;
}

function pmrGetDistricts(city) {
  return PMR_DISTRICTS[city] ? [...PMR_DISTRICTS[city]] : [];
}

function pmrGetAllDistrictEntries() {
  const entries = [];
  Object.keys(PMR_DISTRICTS).forEach((city) => {
    PMR_DISTRICTS[city].forEach((district) => {
      entries.push({ city, district });
    });
  });
  return entries.sort((a, b) => {
    const byCity = a.city.localeCompare(b.city, 'ru');
    if (byCity !== 0) return byCity;
    return a.district.localeCompare(b.district, 'ru');
  });
}

function pmrFormatLocation(city, district) {
  if (!city) return '';
  if (!district) return `г. ${city}`;
  return `г. ${city}, р-н ${district}`;
}

function pmrParseLocation(location) {
  const text = String(location || '').trim();
  let city = '';
  let district = '';

  const sortedCities = [...PMR_CITIES_ALL].sort((a, b) => b.length - a.length);
  for (const c of sortedCities) {
    if (text.toLowerCase().includes(c.toLowerCase())) {
      city = c;
      break;
    }
  }

  if (city) {
    const districts = pmrGetDistricts(city);
    const sortedDistricts = [...districts].sort((a, b) => b.length - a.length);
    for (const d of sortedDistricts) {
      if (text.toLowerCase().includes(d.toLowerCase())) {
        district = d;
        break;
      }
    }
  }

  return { city, district };
}

function pmrLocationMatchesCity(location, city) {
  const loc = pmrNormalizeLocation(location);
  return loc.includes(String(city || '').toLowerCase());
}

function pmrLocationMatchesDistrict(location, city, district) {
  if (!pmrLocationMatchesCity(location, city)) return false;
  const loc = pmrNormalizeLocation(location);
  return loc.includes(String(district || '').toLowerCase());
}

function pmrLocationMatchesDistrictName(location, districtName, scopeCities) {
  const districtLower = String(districtName || '').toLowerCase();
  const loc = pmrNormalizeLocation(location);
  if (!districtLower || !loc.includes(districtLower)) return false;

  const cities = scopeCities instanceof Set ? scopeCities : new Set(scopeCities || []);
  if (cities.size > 0) {
    for (const city of cities) {
      if (pmrLocationMatchesDistrict(location, city, districtName)) return true;
    }
    return false;
  }

  const parsed = pmrParseLocation(location);
  if (parsed.city) {
    return (PMR_DISTRICTS[parsed.city] || []).includes(districtName);
  }

  for (const city of Object.keys(PMR_DISTRICTS)) {
    if (pmrLocationMatchesDistrict(location, city, districtName)) return true;
  }
  return false;
}

function pmrGroupByLetter(items, getLabel) {
  const groups = new Map();
  items.forEach((item) => {
    const label = getLabel(item);
    const letter = label.charAt(0).toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(item);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'ru'));
}

function pmrDistrictLabel(entry) {
  return entry.district;
}

function pmrDistrictHint(entry) {
  return entry.city;
}
