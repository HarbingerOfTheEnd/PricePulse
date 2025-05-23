import axios from "axios";
import camelcaseKeys from "camelcase-keys";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
});
api.interceptors.response.use((response) => {
    if (
        response.data &&
        typeof response.data === "object" &&
        !(response.data instanceof Blob)
    ) {
        response.data = camelcaseKeys(response.data, { deep: true });
    }
    return response;
});
