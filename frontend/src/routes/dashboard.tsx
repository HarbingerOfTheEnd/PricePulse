import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/dashboard")({
    component: RouteComponent,
});

function RouteComponent(): ReactNode {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-200 to-white p-6 flex flex-col items-center gap-6">
            <h1 className="text-xl font-semibold text-center text-blue-900">
                PricePulse - E-Commerce Price Tracker
            </h1>

            <div className="flex w-full max-w-lg gap-2">
                <Input placeholder="Enter Amazon Product URL:" />
                <Button className="bg-green-500 hover:bg-green-600">
                    Track
                </Button>
            </div>

            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-md font-semibold">
                        Product Preview:
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-200 rounded" />{" "}
                    {/* Image Placeholder */}
                    <div>
                        <p>Samsung Galaxy M14</p>
                        <p className="text-sm text-muted-foreground">
                            Current Price: ₹13,499
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="w-full max-w-lg h-48">
                <CardHeader>
                    <CardTitle className="text-md font-semibold">
                        Price History Graph:
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center text-gray-400">
                    [Graph Placeholder]
                </CardContent>
            </Card>

            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-md font-semibold">
                        Available on Other Platforms (Bonus):
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                    <p>- Flipkart: ₹13,299</p>
                    <p>- Meesho: ₹13,499</p>
                    <p>- BigBasket: Not Available</p>
                </CardContent>
            </Card>
        </div>
    );
}
