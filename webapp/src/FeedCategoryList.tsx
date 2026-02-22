import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DataService from "./service/DataService";
import SettingsSubNavigation from "./components/SettingsSubNavigation";

const ds = DataService.getInstance();

export default function FeedCategoryList() {
  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeedCategories = async () => {
      setLoading(true);
      try {
        const categories = await ds.getFeedCategories();
        categories.sort((a, b) => (a.id || 0) - (b.id || 0));
        setFeedCategories(categories);
      } catch (error) {
        console.error("Error loading feed categories:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFeedCategories();
  }, []);

  const handleDelete = async (categoryId: number | undefined) => {
    if (categoryId === undefined) {
      alert("Cannot delete: Invalid category ID");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to delete this category? Feeds assigned to it will still be available."
      )
    ) {
      return;
    }

    try {
      await ds.removeFeedCategory(categoryId);
      setLoading(true);
      try {
        const categories = await ds.getFeedCategories();
        categories.sort((a, b) => (a.id || 0) - (b.id || 0));
        setFeedCategories(categories);
      } catch (error) {
        console.error("Error reloading feed categories:", error);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error deleting feed category:", error);
      alert("Error deleting category");
    }
  };

  return (
    <>
      <SettingsSubNavigation activeSection="feed-categories" />

      <main id="main-content">
        <div id="table-panel">
          <div>
            <h3>Feed Categories</h3>

            <Link to="/feed-categories/new" className="text-decoration-none">
              <i className="bi bi-plus"></i> Add Category
            </Link>

            {loading ? (
              <p>Loading categories...</p>
            ) : feedCategories.length === 0 ? (
              <p>No feed categories found</p>
            ) : (
              <table className="table table-striped table-borderless table-sm feeds-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category {feedCategories.length}</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedCategories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.id}</td>
                      <td>
                        {category.id === 0 ? (
                          category.title
                        ) : (
                          <Link
                            to={`/feed-categories/edit/${category.id}`}
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
