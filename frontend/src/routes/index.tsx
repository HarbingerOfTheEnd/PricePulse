import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/")({
    component: App,
});

function App(): ReactNode {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <div className="flex items-center justify-center w-full h-[33%]" />
            <Link to="/signup" className="text-4xl">
                Sign up if you don't have an account
            </Link>
            <div className="flex items-center justify-center w-full h-[30%]" />
            <Link to="/login" className="text-4xl">
                Login if you have an account
            </Link>
            <div className="flex items-center justify-center w-full h-[30%]" />
        </div>
    );
}
