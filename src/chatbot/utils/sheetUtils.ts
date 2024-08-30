function removeDuplicatesAndJoin(data) {
    const flatData = data.map(item => item[0]);
    const uniqueData = [...new Set(flatData)];
    const result = uniqueData.join(', ');

    return result;
}

function transformMenu(menu: string[][]): string {
  return menu
    .slice(1) // Skip the header row
    .map((item) => `${item[0]} - ${item[1]} - ${item[2]} - ${item[3] ?? ""}`)
    .join("\n"); // Join all items into a single string with newline separators
}

function formatToArrayOfObjects(data) {
    const keys = data[0].map(key => 
        key.toLowerCase()
           .normalize('NFD') // Normalize the string to decompose special characters
           .replace(/[\u0300-\u036f]/g, '') // Remove accents
    );
    
    const result = data.slice(1).map(item => {
        const obj = {};
        item.forEach((value, index) => {
            obj[keys[index]] = value;
        });
        return obj;
    });

    return result;
}

const replaceAccentedCharacters = (str) => {
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function filterAndFormatByZone(properties, zone) {
    const formattedProps = formatToArrayOfObjects(properties);
    const normalizedZone = replaceAccentedCharacters(zone);

    const filteredData = formattedProps.filter(item => replaceAccentedCharacters(item.Zona) === normalizedZone);

    const result = filteredData.map(item => {
        return {
            body: `${item.Propiedad} en ${item.Zona}, Fraccionamiento ${item.Fraccionamiento}, número ${item.Numero}`,
            media: item.Imagen,
            delay: 500
        };
    });

    return result;
}

function filterByDay(data, day) {
    return data.filter(item => item.dia.toLowerCase() === day.toLowerCase());
}

export { removeDuplicatesAndJoin, filterAndFormatByZone, transformMenu, formatToArrayOfObjects, filterByDay }