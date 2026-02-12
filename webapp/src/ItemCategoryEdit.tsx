import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";

const ds = DataService.getInstance();

export default function ItemCategoryEdit() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const isNew = !categoryId;
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const [formItemCategoryData, setFormItemCategoryData] =
    useState<ItemCategory>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const loadFormItemCategoryData = async () => {
      if (isNew) {
        setFormItemCategoryData({ title: "", text: "" });
      } else {
        const categoryIdNum = parseInt(categoryId || "0");
        const itemCategory = await ds.getItemCategoryById(categoryIdNum);
        if (itemCategory) {
          setFormItemCategoryData(itemCategory);
          setValue("title", itemCategory.title);
          setValue("text", itemCategory.text);
        }
      }
    };

    loadFormItemCategoryData();
  }, [categoryId, isNew, setValue]);

  const onSubmit = useCallback(
    async (data: FieldValues) => {
      const itemCategory: ItemCategory = {
        id: isNew ? undefined : parseInt(categoryId || "0"),
        title: data.title,
        text: data.text,
      };

      if (isNew) {
        await ds.addItemCategory(itemCategory);
      } else {
        await ds.updateItemCategory(itemCategory);
      }

      navigate("/item-categories/list");
    },
    [navigate, categoryId, isNew]
  );

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this category? Items assigned to it will still be available."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const categoryIdNum = parseInt(categoryId || "0");
      const success = await ds.removeItemCategory(categoryIdNum);
      if (success) {
        navigate("/item-categories/list");
      } else {
        setDeleteError("Failed to delete category");
      }
    } catch (error) {
      setDeleteError("Error deleting category");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  }, [navigate, categoryId]);

  return (
    <>
      <nav id="sidebar-menu" />

      <main id="main-content">
        <div id="feed-panel">
          <div id="panel-single-column">
            <form onSubmit={handleSubmit(onSubmit)}>
              <h3>
                {isNew ? "New " : "Edit "}
                Category{" "}
                {formItemCategoryData?.title
                  ? `- ${formItemCategoryData.title}`
                  : ""}
              </h3>
              <div>
                <label htmlFor="title" className="form-label">
                  Category Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="title"
                  maxLength={256}
                  required
                  {...register("title")}
                />
                {errors.title && <p>Title is required</p>}
              </div>
              <div>
                <label htmlFor="text" className="form-label">
                  Description
                </label>
                <textarea
                  className="form-control"
                  id="text"
                  rows={4}
                  {...register("text")}
                />
              </div>

              {deleteError && <div role="alert">{deleteError}</div>}

              <button type="submit" className="btn btn-primary">
                Save
              </button>

              {!isNew && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              )}

              <Link
                to="/item-categories/list"
                className="btn btn-outline-secondary"
              >
                Back
              </Link>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
