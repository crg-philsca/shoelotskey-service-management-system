import { RandomForestRegression } from 'ml-random-forest';
import { JobOrder } from '@/app/types';

/**
 * Extract features from a JobOrder to use in the Random Forest model.
 * 
 * Features array structure:
 * 0: Total number of shoes
 * 1: Is Rush? (1 or 0)
 * 2: Is Premium? (1 or 0)
 * 3: Total Services Count
 * 4: Total Add-ons Count
 * 5: Current Workload (Active orders in systems)
 * 6: Heuristic Recommendation (Days based on service types)
 */
export function extractFeatures(order: JobOrder, workload: number = 0, baseDays: number = 0): number[] {
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

    return [totalShoes, isRush, isPremium, totalServicesCount, totalAddonsCount, workload, baseDays];
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
            // Need historical workload for real accuracy, but for now we use 0 or current
            const features = extractFeatures(o, 0, 10); // Dummy fallback values for historical
            const start = new Date(o.transactionDate || o.createdAt).getTime();
            const end = new Date(o.actualCompletionDate!).getTime();
            const diffDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));

            trainingX.push(features);
            trainingY.push(diffDays);
        });
    } else {
        // Generate synthetic baseline data including workload [5] and heuristic [6]
        const syntheticRules = [
            // [shoes, isRush, isPremium, services, addons, workload, heuristic], expectedDays
            [[1, 0, 0, 1, 0, 5, 10], 11], // low workload + baseline
            [[1, 0, 0, 1, 0, 25, 10], 15], // high workload -> +4 days delay
            [[2, 0, 0, 2, 0, 10, 12], 14],
            [[1, 1, 0, 1, 0, 10, 5], 5],  // rush still prioritizes fast
            [[1, 0, 1, 1, 1, 10, 8], 9],
            [[3, 0, 0, 3, 2, 20, 15], 20], // heavy bulk + heavy workload
            [[1, 0, 0, 1, 1, 5, 11], 12],
            [[1, 1, 0, 2, 2, 40, 7], 10], // rush but EXTREME workload
            [[5, 0, 0, 5, 5, 10, 20], 25], // bulk regular
            [[5, 1, 0, 5, 5, 10, 10], 12]  // bulk rush
        ];

        // Populate samples
        for (let i = 0; i < 60; i++) {
            const rule = syntheticRules[i % syntheticRules.length];
            const baseFeats = rule[0] as number[];
            const noiseX = [
                baseFeats[0] + Math.floor(Math.random() * 2),
                baseFeats[1],
                baseFeats[2],
                baseFeats[3],
                baseFeats[4],
                baseFeats[5] + Math.floor(Math.random() * 5), // workload drift
                baseFeats[6] // heuristic baseline
            ];
            const noiseY = (rule[1] as number) + (Math.random() * 1.5 - 0.75);

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
export function predictCompletionDays(order: Partial<JobOrder>, fallbackLogicDays: number, currentWorkload: number = 0): number {
    if (!model) {
        return fallbackLogicDays;
    }

    try {
        const features = extractFeatures(order as JobOrder, currentWorkload, fallbackLogicDays);
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
