import Location from './Location';
import { WeatherRequest, WeatherRequestOptions} from './WeatherRequest';
import * as keys from './keys.json';
import Key from './Key';
import Thread from 'async-threading';

import sizeof from 'object-sizeof'

export default class CacheManager {

    private static requests = Array<WeatherRequest>();
    private static requestValidator: Thread;

    public static acceptableRaidius = 1; // degree

    private static keys = Array<Key>();

    public static init(): void {
        keys['keys'].forEach(key => {
            CacheManager.keys.push( new Key(key) );
        });
        CacheManager.requestValidator = new Thread( () => {
            for (let i = 0; i < CacheManager.requests.length; i++) {
                if (CacheManager.requests[i].hasExpired()) {
                    CacheManager.requests.splice(i, 1);
                    console.log(CacheManager.requests)
                    i--;
                }
            }
            console.log(sizeof(CacheManager.requests))
        }, 60 * 1000, false);
    }

    private static getWorkingKey(): Key | null {
        for (let i = 0; i < CacheManager.keys.length; i++) {
            if (CacheManager.keys[i].isValid) {
                return CacheManager.keys[i];
            }
        }
        return null;
    }

    private static validateLocation(location: Location): boolean {
        return !(isNaN(location.longitude) || isNaN(location.latitude));
    }

    private static newRequest(location: Location, key: Key) {
        let newRequestOptions = {
            location : location,
        } as WeatherRequestOptions;

        let newWeatherRequest = new WeatherRequest(newRequestOptions);
        
        CacheManager.requests.push(newWeatherRequest);

        return newWeatherRequest.getData(key);
    }

    public static async response(location: Location): Promise<any> {
        
        if (!CacheManager.validateLocation(location)) {
            return {
                error : 400,
                message : 'Location not valid.',
                request : {
                    longitude : location.longitude,
                    latitude : location.latitude
                }
            }
        }

        let workingKey = CacheManager.getWorkingKey();
        if (workingKey == null) {
            return {
                error : 500,
                message : 'No working keys.',
                request : {
                    longitude : location.longitude,
                    latitude : location.latitude
                }
            }
        }

        if (CacheManager.requests.length < 1) {
            return await CacheManager.newRequest(location, workingKey);
        }

        let distances = Array<Number>();

        CacheManager.requests.forEach( request => {
            distances.push(request.location.getDistance(location));
        });

        let lowestNumber = distances[0];
        let lowestIndex = 0;

        for (let i = 0; i < distances.length; i++) {
            if (distances[i] < lowestNumber) {
                lowestNumber = distances[i];
                lowestIndex = i;
            }
        }

        if (lowestNumber <= CacheManager.acceptableRaidius) {
            return CacheManager.requests[lowestIndex].getData(workingKey); // Serves the cached response.
        } else {
            return await CacheManager.newRequest(location, workingKey); // Creates a new response, and waits for it to resolve.
        }
    }
}