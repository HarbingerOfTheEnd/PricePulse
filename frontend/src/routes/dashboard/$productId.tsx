import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    CategoryScale,
    type ChartData,
    Chart as ChartJS,
    Colors,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Title,
    Tooltip,
} from "chart.js";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Colors,
);

export const Route = createFileRoute("/dashboard/$productId")({
    component: RouteComponent,
});

type Price = {
    id: string;
    price: number;
    priceAt: string;
};
type Product = {
    id: string;
    issuedById: number;
    amazonUrl: string;
    name: string;
};
type Message =
    | {
          type: "connected";
          connection_id: string;
          timestamp: string;
      }
    | {
          type: "price_data";
          product_id: string;
          price: number;
          selector_used: string;
          timestamp: string;
          status: "success";
      }
    | {
          type: "price_data";
          product_id: string;
          price: number;
          selector_used: string;
          timestamp: string;
          status: "error";
          error: string;
      }
    | {
          type: "keepalive";
          timestamp: string;
          next_update_in: string;
      };

function RouteComponent(): ReactNode {
    const { productId } = Route.useParams();
    const [userId, setUserId] = useState<number | null>(null);
    const esRef = useRef<EventSource | null>(null);
    const [livePrices, setLivePrices] = useState<Price[]>([]);
    const chartData: ChartData<"line", number[], string> = {
        labels: livePrices.map((price) =>
            new Date(price.priceAt).toLocaleString(),
        ),
        datasets: [
            {
                label: "Price",
                data: livePrices.map((price) => price.price),
                fill: false,
            },
        ],
    };

    useEffect(() => {
        const userId = Number.parseInt(localStorage.getItem("userId") || "0");
        setUserId(userId);

        (async () => {
            const response = await api.get("/prices", {
                params: { user_id: userId, product_id: productId },
            });

            if (typeof response.data !== "object")
                setLivePrices(response.data as Price[]);
        })();

        const trackPricesUrl = new URL(
            `${import.meta.env.VITE_SERVER_URL}/track-price`,
        );
        trackPricesUrl.searchParams.append("user_id", userId.toString());
        trackPricesUrl.searchParams.append("product_id", productId);

        const es = new EventSource(trackPricesUrl);
        es.onmessage = (event: MessageEvent<string>) => {
            const data = JSON.parse(event.data) as Message;
            switch (data.type) {
                case "price_data":
                    setLivePrices((prev) => [
                        ...prev,
                        {
                            id: data.product_id,
                            price: data.price,
                            priceAt: data.timestamp,
                        },
                    ]);
                    break;
            }
        };
        es.onerror = () => es.close();

        esRef.current = es;

        return () => es.close();
    }, [productId]);

    const { data: product, isLoading } = useQuery({
        queryKey: ["product", productId, userId],
        queryFn: async (): Promise<Product> => {
            const response = await api.get(`/products/${productId}`, {
                params: { user_id: userId },
            });

            return response.data as Product;
        },
        enabled: !!userId,
    });

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <Card className="max-w-5xl w-full mx-auto mt-12">
            <CardHeader className="py-6 px-8">
                <div className="flex items-center space-x-6">
                    <h2 className="text-3xl font-extrabold">{product?.name}</h2>
                    <a
                        href={product?.amazonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg text-blue-600 hover:underline"
                    >
                        View on Amazon
                    </a>
                </div>
            </CardHeader>
            <CardContent className="py-8 px-8">
                <div className="h-[500px]">
                    <Line
                        data={chartData}
                        options={{ maintainAspectRatio: false }}
                    />
                </div>
            </CardContent>
            {livePrices.length === 0 && (
                <div className="text-center text-gray-500">
                    No price data available.
                </div>
            )}
        </Card>
    );
}
