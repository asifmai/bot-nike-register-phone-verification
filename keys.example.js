const chance = require('chance').Chance();
const moment = require('moment');

module.exports = {
    siteLink: 'https://www.nike.com/ca/launch', // Change it to your country
    settingsPageLink: 'https://www.nike.com/ca/member/settings', // Change it to your country
    apiKey: '', // http://onlinesim.ru/ Api Key
    generateAccount: () => {
        const firstName = chance.first({nationality: 'en'});
        const lastName = chance.last({nationality: 'en'});
        const rndEmail = Math.ceil(Math.random() * 100);
        const rndPassword = Math.ceil(Math.random() * 100);
        const birthday = chance.birthday();
        return {
            firstName,
            lastName,
            email: `${firstName.toLowerCase() + lastName.toLowerCase() + rndEmail}@example.com`,
            month: moment(birthday).format('MM'),
            day: moment(birthday).format('DD'),
            year: moment(birthday).format('YYYY'),
            gender: chance.gender(),  // 'Male' or 'Female'
            country: 'CA',  // country code
            password: capitalizeFirstLetter(firstName.toLowerCase()) + lastName.toLowerCase() + rndPassword,
        }
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}