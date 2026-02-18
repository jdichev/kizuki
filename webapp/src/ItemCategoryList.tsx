import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DataService from "./service/DataService";

const ds = DataService.getInstance();

export default function ItemCategoryList() {
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItemCategories = async () => {
      setLoading(true);
      try {
        const categories = await ds.getItemCategories();
        categories.sort((a, b) => (a.id || 0) - (b.id || 0));
        setItemCategories(categories);
      } catch (error) {
        console.error("Error loading categories:", error);
      } finally {
        setLoading(false);
      }
    };

    loadItemCategories();
  }, []);

  const handleDelete = async (categoryId: number | undefined) => {
    if (categoryId === undefined) {
      alert("Cannot delete: Invalid category ID");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to delete this category? Items assigned to it will still be available."
      )
    ) {
      return;
    }

    try {
      const success = await ds.removeItemCategory(categoryId);
      if (success) {
        setLoading(true);
        try {
          const categories = await ds.getItemCategories();
          categories.sort((a, b) => (a.id || 0) - (b.id || 0));
          setItemCategories(categories);
        } catch (error) {
          console.error("Error reloading categories:", error);
        } finally {
          setLoading(false);
        }
      } else {
        alert("Failed to delete category");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Error deleting category");
    }
  };

  return (
    <>
      <nav id="main-sidebar" />

      <main id="main-content">
        <div id="table-panel">
          <div>
            <h3>Item Categories</h3>

            <Link to="/item-categories/new" className="text-decoration-none">
              <i className="bi bi-plus"></i> Add Category
            </Link>

            {loading ? (
              <p>Loading categories...</p>
            ) : itemCategories.length === 0 ? (
              <p>No item categories found</p>
            ) : (
              <table className="table table-striped table-borderless table-sm feeds-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category {itemCategories.length}</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {itemCategories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.id}</td>
                      <td>
                        {category.id === 0 ? (
                          category.title
                        ) : (
                          <Link
                            to={`/item-categories/edit/${category.id}`}
                            className="text-decoration-none"
                          >
                            {category.title}
                          </Link>
                        )}
                      </td>
                      <td>{category.text || "\u2014"}</td>
                      {category.id !== 0 && (
                        <td>
                          <a
                            href="/"
                            className="text-decoration-none"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDelete(category.id);
                            }}
                            title="Delete category"
                          >
                            <i className="bi bi-trash"></i>
                          </a>
                        </td>
                      )}
                      {category.id === 0 && <td></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
