import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler, AppError } from "../../lib/error-handler";
import { prisma } from "../../lib/prisma";

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

const CreateTagInput = z.object({ name: z.string().min(1).max(50), color: z.string().max(20).optional() });
const UpdateTagInput = CreateTagInput.partial();

tagsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tags = await prisma.tag.findMany({ where: { ownerId: req.user!.id }, orderBy: { name: "asc" } });
    res.json(tags);
  })
);

tagsRouter.post(
  "/",
  validateBody(CreateTagInput),
  asyncHandler(async (req, res) => {
    const existing = await prisma.tag.findUnique({
      where: { ownerId_name: { ownerId: req.user!.id, name: req.body.name } },
    });
    if (existing) throw AppError.conflict("A tag with this name already exists");
    const tag = await prisma.tag.create({ data: { ownerId: req.user!.id, name: req.body.name, color: req.body.color } });
    res.status(201).json(tag);
  })
);

async function assertTagOwnership(userId: string, id: string) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw AppError.notFound("Tag not found");
  if (tag.ownerId !== userId) throw AppError.forbidden("Not your tag");
  return tag;
}

tagsRouter.patch(
  "/:id",
  validateBody(UpdateTagInput),
  asyncHandler(async (req, res) => {
    await assertTagOwnership(req.user!.id, req.params.id);
    const tag = await prisma.tag.update({ where: { id: req.params.id }, data: req.body });
    res.json(tag);
  })
);

tagsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertTagOwnership(req.user!.id, req.params.id);
    await prisma.tag.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
