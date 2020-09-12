
const fs = require('fs');
const puppeteer = require('puppeteer');

const badCharactersBoundaries = {
  '\[': '\]',
};
const badCharacters = ['\*', '\~', '\^', '\(', '\)'];
const beginningRE = new RegExp(`[${Object.keys(badCharactersBoundaries).join('')}]`, 'g');
const endRE = new RegExp(`[${Object.values(badCharactersBoundaries).join('')}]`, 'g');
const badCharacterRE = new RegExp(`[${badCharacters.join('')}]`, 'g');

const main = async function () {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('https://en.wikipedia.org/wiki/List_of_Formula_One_drivers')
    const tableHandle = await getTableHandle(page);
    const [headHandle, bodyHandle] = await getElementChildren(page, tableHandle);
    const headings = await getHeadings(page, headHandle);
    const rows = await getRows(page, bodyHandle);
    const completeData = [headings, ...rows].join('');
    writeToFile('driver-data.csv', completeData);
  } catch (e) {
    console.log(e)
  }

  await browser.close();
};

const getRows = async function (page, bodyHandle) {
  const rowHandles = await getElementChildren(page, bodyHandle);
  const rows = [];
  for (const rowHandle of rowHandles) {
    const row = await getRow(page, rowHandle);
    rows.push(row);
  }
  return rows;
}

const getRow = async function (page, rowHandle) {
  const columnHandles = await getElementChildren(page, rowHandle);
  const columns = [];
  for (let i = 0; i < columnHandles.length; i++) {
    const columnHandle = columnHandles[i];
    const column = await getColumn(page, columnHandle, i);
    columns.push(column);
  }
  return columns.join(',') + "\n";
}

const getColumn = async function (page, columnHandle, i) {
  let innerText = await getElementPropertyDOM(page, columnHandle, 'innerText');
  if (i === 1) {
    innerText = innerText.slice(1);
  }
  if ([0, 1, 4, 5, 6, 7, 8, 9].includes(i)) {
    innerText = formatInnerText(innerText);
  }
  if (i === 2) {
    innerText = formatYears(innerText);
  }
  if (i === 3) {
    innerText = getChampionships(innerText);
  }
  if (i === 10) {
    innerText = getPoints(innerText);
  }
  return innerText;
}

const getPoints = function (innerText) {
  const [points, adjustedPoints] = innerText.split(' ');
  const formattedPoints = formatInnerText(points);
  const formattedAdjustedPoints = adjustedPoints ? formatInnerText(adjustedPoints) : formattedPoints;
  return `${formattedPoints},${formattedAdjustedPoints}`;
}

const getChampionships = function (innerText) {
  const [nOfChampionships, championshipYears] = innerText.split('\n');
  const formattedYears = championshipYears ? formatYears(championshipYears) : '';
  return `${nOfChampionships},${formattedYears}`;
}

const formatYears = function (innerText) {
  const years = innerText.split(', ');
  const formattedList = [];
  for (const year of years) {
    if (year.includes('–')) {
      const [lowerBound, upperBound] = year.split('–');
      const replacement = [];
      const upperBoundInt = parseInt(upperBound, 10);
      const lowerBoundInt = parseInt(lowerBound, 10);
      const difference = upperBoundInt - lowerBoundInt;
      for (let i = 0; i <= difference; i++) {
        const nextYear = lowerBoundInt + i;
        replacement.push(nextYear.toString());
      }
      formattedList.push(replacement.join(';'));
    } else {
      formattedList.push(year);
    }
  }
  return formattedList.join(';');
}

const getHeadings = async function (page, headHandle) {
  // We're manually defining the headings as we want to split the championships and points columns in two
  // the code below will return the values of the original headings from the table.

  /* const [headRowHandle] = await getElementChildren(page, headHandle);
  const headingHandles = await getElementChildren(page, headRowHandle)
  const headings = [];
  for (const headingHandle of headingHandles) {
    const innerText = await getElementPropertyDOM(page, headingHandle, 'innerText');
    const formattedInnerText = formatInnerText(innerText)
    headings.push(formattedInnerText);
  }
  return headings.join(',') + '\n'; */

  return 'Name,Country,Seasons,Championships,Championship Years,Entries,Starts,Poles,Wins,Podiums,Fastest laps,Points, Adjusted Points\n'
}

const getTableHandle = async function (page) {
  const [_, tableHandle] = await page.$$('table.wikitable');
  return tableHandle;
}

const getElementChildren = async function (page, elementHandle) {
  const elementChildrenHandle = await getElementPropertyHandle(page, elementHandle, 'children');
  const elementProperties = await elementChildrenHandle.getProperties();
  const elementChildren = [];
  for (const property of elementProperties.values()) {
    const child = property.asElement();
    if (child) {
      elementChildren.push(child)
    }
  }
  return elementChildren;
}

const getElementPropertyHandle = async function (page, elementHandle, property) {
  return await page.evaluateHandle((element, property) => element[property], elementHandle, property);
}

const getElementPropertyDOM = async function (page, elementHandle, property) {
  return await page.evaluate((element, property) => element[property], elementHandle, property);
}

const formatInnerText = function (innerText) {
  const filteredInnerText = innerText
    .replace(/(, )/g, ';')
    .replace(badCharacterRE, '')
    .trimStart();
  [start, ...rest] = filteredInnerText.split(beginningRE);
  const formattedTexts = [start];
  for (const text of rest) {
    const [_, formattedText] = text.split(endRE);
    formattedTexts.push(formattedText);
  }
  return formattedTexts.join('');
}

const writeToFile = function (name, data) {
  fs.writeFile(name, data, (e) => {
    if (e) return console.log(e);
    return console.log("done");
  });
}

main();
