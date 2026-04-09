import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import purchaseRouter from "./purchase";
import sampleOptionsRouter from "./sample-options";
import sampleSkuLinesRouter from "./sample-sku-lines";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(purchaseRouter);
router.use(sampleOptionsRouter);
router.use(sampleSkuLinesRouter);
router.use(statsRouter);

export default router;
