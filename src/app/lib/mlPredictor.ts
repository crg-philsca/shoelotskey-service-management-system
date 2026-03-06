import { RandomForestRegression } from 'ml-random-forest';
import { JobOrder } from '@/app/types';

/**
 * Extract features from a JobOrder to use in the Random Forest model.
 * 
 * Features array structure:
 * 0: Total number of shoes
 * 1: Is Rush? (1 or 0)
 * 2: Is Premium? (1 or 0)
 * 3: Number of different services applied
 * 4: Number of add-ons applied
 */
export function extractFeatures(order: JobOrder): number[] {
    const totalShoes = order.items ? order.items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) : 1;
    const isRush = order.priorityLevel === 'rush' ? 1 : 0;
    const isPremium = order.priorityLevel === 'premium' ? 1 : 0;

    let totalServicesCount = 0;
    let totalAddonsCount = 0;

    const items = order.items?.length ? order.items : [order];

    items.forEach((item: any) => {
        if (Array.isArray(item.baseService)) {
            totalServicesCount += item.baseService.length;
        } else if (item.baseService) {
            totalServicesCount += 1;
        }

        if (Array.isArray(item.addOns)) {
            totalAddonsCount += item.addOns.length;
        }
    });

    return [totalShoes, isRush, isPremium, totalServicesCount, totalAddonsCount];
}

let model: RandomForestRegression | null = null;
let isTraining = false;

/**
 * Train the model on historical orders where actualCompletionDate is set.
 */
export function trainPredictionModel(orders: JobOrder[]) {
    if (isTraining) return;

    const completedOrders = orders.filter(o => o.actualCompletionDate && o.transactionDate);

    // Fall back to generating synthetic training data if we don't have enough real completed orders
    const trainingX: number[][] = [];
    const trainingY: number[] = [];

    if (completedOrders.length > 5) {
        completedOrders.forEach(o => {
            const features = extractFeatures(o);
            const start = new Date(o.transactionDate || o.createdAt).getTime();
            const end = new Date(o.actualCompletionDate!).getTime();
            const diffDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));

            trainingX.push(features);
            trainingY.push(diffDays);
        });
    } else {
        // Generate synthetic baseline data to ensure the model has something to learn
        // This simulates a baseline behavior roughly matching the fixed heuristic logic
        const syntheticRules = [
            // [shoes, isRush, isPremium, services, addons], expectedDays
            [[1, 0, 0, 1, 0], 10], // 1 shoe, regular, 1 service, 0 addons -> 10 days
            [[2, 0, 0, 2, 0], 12], // 2 shoes, regular, 2 services, 0 addons -> 12 days
            [[1, 1, 0, 1, 0], 5],  // 1 shoe, rush -> 5 days
            [[1, 0, 1, 1, 1], 8],  // premium -> 8 days
            [[3, 0, 0, 3, 2], 15],
            [[1, 0, 0, 1, 1], 11],
            [[1, 1, 0, 2, 2], 7],
            [[5, 0, 0, 5, 5], 20], // bulk regular
            [[5, 1, 0, 5, 5], 10], // bulk rush
            [[1, 0, 0, 0, 0], 5] // dummy fallback
        ];

        // Populate enough samples for the random forest
        for (let i = 0; i < 50; i++) {
            const rule = syntheticRules[i % syntheticRules.length];
            // Add a little bit of noise for variance
            const noiseX = [(rule[0] as number[])[0] + Math.floor(Math.random() * 2), (rule[0] as number[])[1], (rule[0] as number[])[2], (rule[0] as number[])[3], (rule[0] as number[])[4]];
            const noiseY = (rule[1] as number) + (Math.random() * 2 - 1);

            trainingX.push(noiseX);
            trainingY.push(Math.max(1, noiseY));
        }
    }

    try {
        isTraining = true;
        const rf = new RandomForestRegression({
            seed: 42,
            maxFeatures: 1.0,
            replacement: true,
            nEstimators: 20
        });

        rf.train(trainingX, trainingY);
        model = rf;
    } catch (err) {
        console.error("Failed to train random forest model:", err);
    } finally {
        isTraining = false;
    }
}

/**
 * Expects a JobOrder object or similar structure to extract features from and predict completion days.
 */
export function predictCompletionDays(order: Partial<JobOrder>, fallbackLogicDays: number): number {
    if (!model) {
        return fallbackLogicDays;
    }

    try {
        const features = extractFeatures(order as JobOrder);
        const prediction = model.predict([features]);
        // prediction[0] should be our predicted number of days
        const predictedDays = Math.ceil(prediction[0]);
        // Minimum 1 day prediction
        return Math.max(1, predictedDays);
    } catch (e) {
        console.warn("Prediction failed, falling back to heuristic", e);
        return fallbackLogicDays;
    }
}
