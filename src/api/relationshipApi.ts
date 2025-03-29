import { Router } from 'express';
import { Storage } from '../core/storage';

const router = Router();
const storage = new Storage();

// 获取关系数据，同时获取相关节点信息
router.get('/relationships', async (req, res) => {
  try {
    const type = req.query.type as string;
    
    // 获取关系数据
    const relationships = await storage.getRelationships({
      type: type !== 'all' ? type : undefined
    });
    
    // 获取所有相关节点的ID
    const nodeIds = new Set<string>();
    relationships.forEach(rel => {
      nodeIds.add(rel.from);
      nodeIds.add(rel.to);
    });
    
    // 获取所有相关节点的详细信息
    const nodes: Record<string, any> = {};
    for (const id of nodeIds) {
      const node = await storage.getNodeById(id);
      if (node) {
        nodes[id] = node;
      }
    }
    
    res.json({
      relationships,
      nodes
    });
  } catch (error) {
    console.error('获取关系数据失败:', error);
    res.status(500).json({ 
      error: '获取关系数据失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 获取关系详情
router.get('/relationship/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // 获取关系数据
    const relationship = await storage.getRelationshipById(id);
    if (!relationship) {
      return res.status(404).json({ error: '找不到指定的关系' });
    }
    
    // 获取源节点和目标节点
    const fromNode = await storage.getNodeById(relationship.from);
    const toNode = await storage.getNodeById(relationship.to);
    
    res.json({
      relationship,
      fromNode: fromNode || { id: relationship.from, missing: true },
      toNode: toNode || { id: relationship.to, missing: true }
    });
  } catch (error) {
    console.error('获取关系详情失败:', error);
    res.status(500).json({ 
      error: '获取关系详情失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 获取两个节点之间的关系
router.get('/relationship-between', async (req, res) => {
  try {
    const fromId = req.query.from as string;
    const toId = req.query.to as string;
    
    if (!fromId || !toId) {
      return res.status(400).json({ error: '缺少必要的参数' });
    }
    
    // 获取两个节点之间的关系
    const relationships = await storage.getRelationshipsBetween(fromId, toId);
    
    // 获取节点信息
    const fromNode = await storage.getNodeById(fromId);
    const toNode = await storage.getNodeById(toId);
    
    res.json({
      relationships,
      fromNode: fromNode || { id: fromId, missing: true },
      toNode: toNode || { id: toId, missing: true }
    });
  } catch (error) {
    console.error('获取节点间关系失败:', error);
    res.status(500).json({ 
      error: '获取节点间关系失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;