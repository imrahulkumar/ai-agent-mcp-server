import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server-stdio';

const server = new McpServer({ name: 'Weather Data Fetcher', version: '1.0.0' });


async function fetchWeatherData(city) {
    if (city.toLowerCase() === 'london') {
        return { temperature: '15 degrees celsius', condition: 'Cloudy' };
    }
    if (city.toLowerCase() === 'new york') {
        return { temperature: '20 degrees celsius', condition: 'Sunny' };
    }
    if (city.toLowerCase() === 'tokyo') {
        return { temperature: '18 degrees celsius', condition: 'Rainy' };
    } 
    if (city.toLowerCase() === 'paris') {
        return { temperature: '17 degrees celsius', condition: 'Windy' };
    }
}

server.registerTool(
    'getWeatherDataByCityName',
    {
        description: 'Fetch weather data by city name',
        city: z.string()
    },
    async ({ city }) => ({
        content: [{ type: 'text', text: `Fetching weather data for ${JSON.stringify(await fetchWeatherData(city))}` }]
    })
);

async function main() { 
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main();