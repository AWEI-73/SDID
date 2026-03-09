import json
import os
from typing import List, Dict, Any, Set

class MMLAParser:
    def __init__(self):
        self.nodes = {}
        self.edges = []
        self.adjacency_list = {}
        self.in_degree = {}

    def load_data(self, file_path: str):
        """Load raw JSON data from React Flow."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        raw_nodes = data.get("nodes", [])
        self.edges = data.get("edges", [])
        
        # Index nodes by ID
        for node in raw_nodes:
            self.nodes[node["id"]] = node
            self.adjacency_list[node["id"]] = []
            self.in_degree[node["id"]] = 0

        # Build Graph
        for edge in self.edges:
            source = edge["source"]
            target = edge["target"]
            # Only consider valid nodes
            if source in self.nodes and target in self.nodes:
                self.adjacency_list[source].append(target)
                self.in_degree[target] += 1

    def topological_sort(self):
        """Perform topological sort to detect cycles."""
        queue = [node_id for node_id, degree in self.in_degree.items() if degree == 0]
        sorted_order = []
        
        while queue:
            node_id = queue.pop(0)
            sorted_order.append(node_id)
            
            for neighbor in self.adjacency_list[node_id]:
                self.in_degree[neighbor] -= 1
                if self.in_degree[neighbor] == 0:
                    queue.append(neighbor)
                    
        # If sorted_order count != nodes count, there is a cycle
        if len(sorted_order) != len(self.nodes):
            raise ValueError("Cycle detected in the graph! Dependencies must be a DAG.")
        
        return sorted_order

    def validate_edges(self):
        """
        Validate edge connections (Type Validation).
        Simplified logic: Check if source output type matches target input type based on mapping.
        """
        errors = []
        for edge in self.edges:
            source_id = edge["source"]
            target_id = edge["target"]
            
            if source_id not in self.nodes or target_id not in self.nodes:
                continue

            source_node = self.nodes[source_id]
            target_node = self.nodes[target_id]
            
            # Only checking LEAF nodes logic for now
            if source_node.get("type") != "LEAF" or target_node.get("type") != "LEAF":
                continue

            mapping = edge.get("data", {}).get("mapping", {})
            source_field = mapping.get("source_field")
            target_field = mapping.get("target_field")
            
            if not source_field or not target_field:
                continue
                
            # Find output definition in source
            source_outputs = source_node.get("data", {}).get("spec", {}).get("outputs", [])
            source_type = next((item["type"] for item in source_outputs if item["name"] == source_field), None)
            
            # Find input definition in target
            target_inputs = target_node.get("data", {}).get("spec", {}).get("inputs", [])
            target_type = next((item["type"] for item in target_inputs if item["name"] == target_field), None)
            
            if source_type and target_type and source_type != target_type:
                errors.append(f"Type Mismatch on edge {edge['id']}: {source_id}.{source_field}({source_type}) -> {target_id}.{target_field}({target_type})")

        if errors:
             raise ValueError("\n".join(errors))

    def generate_spec(self) -> Dict[str, Any]:
        """Construct the hierarchical MMLA spec."""
        
        # 1. Start with the root node
        root_nodes = [n for n in self.nodes.values() if n.get("type") == "ROOT"]
        if not root_nodes:
             raise ValueError("No ROOT node found.")
        if len(root_nodes) > 1:
             raise ValueError("Multiple ROOT nodes found.")
             
        root = root_nodes[0]
        
        spec = {
            "type": "ROOT",
            "id": root["id"],
            "meta": root.get("data", {}).get("meta", {}),
            "config": root.get("data", {}).get("config", {}),
            "modules": []
        }
        
        # 2. Build Hierarchy recursively
        # Map parent_id -> list of children
        children_map = {}
        for node in self.nodes.values():
            parent = node.get("parentNode")
            if parent:
                if parent not in children_map:
                    children_map[parent] = []
                children_map[parent].append(node)
                
        def build_node(node_data):
            # Transform raw node to spec node
            spec_node = {
                "id": node_data["id"],
                "type": node_data.get("type"),
            }
            
            # Add specific fields based on type
            data = node_data.get("data", {})
            if spec_node["type"] == "BRANCH":
                 spec_node["entity_type"] = "MODULE"
                 spec_node["name"] = data.get("name")
                 spec_node["description"] = data.get("description")
                 spec_node["dependencies"] = data.get("dependencies", [])
                 # Recursive children
                 if node_data["id"] in children_map:
                     spec_node["children"] = [build_node(child) for child in children_map[node_data["id"]]]
            
            elif spec_node["type"] == "LEAF":
                 spec_node["logic_type"] = "FUNCTION"
                 spec_node["name"] = data.get("name")
                 spec_node["status"] = data.get("status", "IDLE")
                 spec_node["spec"] = data.get("spec", {})
            
            return spec_node

        # Root's immediate children (Modules)
        if root["id"] in children_map:
            spec["modules"] = [build_node(child) for child in children_map[root["id"]] if child.get("type") == "BRANCH"]
            
        return spec

if __name__ == "__main__":
    parser = MMLAParser()
    try:
        parser.load_data("raw_graph_mock.json")
        parser.topological_sort()
        parser.validate_edges()
        spec = parser.generate_spec()
        
        output_file = "mmla_spec.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(spec, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully generated {output_file}")
        
    except Exception as e:
        print(f"Parser Error: {str(e)}")
