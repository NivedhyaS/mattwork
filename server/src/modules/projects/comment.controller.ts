import { Request, Response } from 'express';
import { commentService } from './comment.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class CommentController {
  getComments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const comments = await commentService.getComments(req.params.id as string, req.user!);
    ApiResponse.success(res, comments, 'Comments retrieved successfully');
  });

  addComment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const comment = await commentService.addComment(
      req.params.id as string,
      req.body.content as string,
      req.user!
    );
    ApiResponse.created(res, comment, 'Comment added successfully');
  });

  updateComment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const comment = await commentService.updateComment(
      req.params.commentId as string,
      req.body.content as string,
      req.user!
    );
    ApiResponse.success(res, comment, 'Comment updated successfully');
  });

  deleteComment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await commentService.deleteComment(req.params.commentId as string, req.user!);
    ApiResponse.noContent(res);
  });
}

export const commentController = new CommentController();
